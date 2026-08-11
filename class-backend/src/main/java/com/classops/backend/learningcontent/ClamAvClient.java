package com.classops.backend.learningcontent;

import com.classops.backend.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class ClamAvClient {
    private static final int CHUNK = 8192;
    private final ContentProperties properties;

    public ClamAvClient(ContentProperties properties) {
        this.properties = properties;
    }

    public void scan(Path file) {
        if (!properties.clamavEnabled()) return;
        try (Socket socket = new Socket()) {
            int timeout = Math.toIntExact(properties.clamavTimeout().toMillis());
            socket.connect(new InetSocketAddress(properties.clamavHost(), properties.clamavPort()), timeout);
            socket.setSoTimeout(timeout);
            OutputStream out = socket.getOutputStream();
            out.write("zINSTREAM\0".getBytes(StandardCharsets.US_ASCII));
            try (BufferedInputStream input = new BufferedInputStream(Files.newInputStream(file))) {
                byte[] buffer = new byte[CHUNK];
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    out.write(ByteBuffer.allocate(4).putInt(read).array());
                    out.write(buffer, 0, read);
                }
            }
            out.write(ByteBuffer.allocate(4).putInt(0).array());
            out.flush();
            String response = new String(socket.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (!response.contains("OK")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "MALWARE_DETECTED",
                    "File không vượt qua bước quét virus.");
            }
        } catch (IOException | ArithmeticException ex) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "CLAMAV_UNAVAILABLE",
                "Dịch vụ quét virus không khả dụng, vui lòng thử lại sau.",
                java.util.Map.of("retryAfterSeconds", 30));
        }
    }
}
