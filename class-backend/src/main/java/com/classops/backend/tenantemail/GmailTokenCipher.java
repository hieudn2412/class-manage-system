package com.classops.backend.tenantemail;

import com.classops.backend.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

@Component
public class GmailTokenCipher {
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;
    private final GmailProperties properties;
    private final SecureRandom random = new SecureRandom();

    public GmailTokenCipher(GmailProperties properties) {
        this.properties = properties;
    }

    public EncryptedValue encrypt(String plaintext, UUID tenantId, UUID connectionId) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(aad(tenantId, connectionId));
            return new EncryptedValue(cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8)), iv);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Unable to encrypt Gmail token material.", ex);
        }
    }

    public String decrypt(byte[] ciphertext, byte[] iv, UUID tenantId, UUID connectionId) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(aad(tenantId, connectionId));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "GMAIL_REAUTH_REQUIRED",
                "Không thể giải mã token Gmail. Vui lòng kết nối lại Gmail.");
        }
    }

    private SecretKeySpec key() {
        byte[] bytes = Base64.getDecoder().decode(properties.tokenEncryptionKey());
        if (bytes.length != 32) {
            throw new ApiException(HttpStatus.CONFLICT, "GMAIL_NOT_CONFIGURED",
                "Khóa mã hóa Gmail chưa hợp lệ.");
        }
        return new SecretKeySpec(bytes, "AES");
    }

    private byte[] aad(UUID tenantId, UUID connectionId) {
        return (tenantId + ":" + connectionId + ":" + properties.keyVersion())
            .getBytes(StandardCharsets.UTF_8);
    }

    public record EncryptedValue(byte[] ciphertext, byte[] iv) {
    }
}
