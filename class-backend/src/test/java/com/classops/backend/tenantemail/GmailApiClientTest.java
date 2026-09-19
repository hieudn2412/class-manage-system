package com.classops.backend.tenantemail;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

class GmailApiClientTest {
    @Test
    void buildsMultipartAlternativeForProfessionalHtmlEmail() throws Exception {
        GmailApiClient client = new GmailApiClient(properties(), RestClient.builder());
        MimeMessage message = message(client, "Nội dung tiếng Việt", "<html><body><b>Bảng lương</b></body></html>",
            "https://example.test/my-salary");

        assertThat(message.getSubject()).isEqualTo("Thông báo lương");
        assertThat(message.getContentType()).containsIgnoringCase("multipart/alternative");
        MimeMultipart content = (MimeMultipart) message.getContent();
        assertThat(content.getCount()).isEqualTo(2);
        assertThat(content.getBodyPart(0).getContent().toString())
            .contains("Nội dung tiếng Việt", "https://example.test/my-salary");
        assertThat(content.getBodyPart(1).getContent().toString()).contains("<b>Bảng lương</b>");
    }

    @Test
    void keepsExistingNotificationsAsPlainText() throws Exception {
        GmailApiClient client = new GmailApiClient(properties(), RestClient.builder());
        MimeMessage message = message(client, "Thông báo cũ", null, "");

        assertThat(message.getContentType()).containsIgnoringCase("text/plain");
        assertThat(message.getContent().toString()).contains("Thông báo cũ");
    }

    private MimeMessage message(GmailApiClient client, String text, String html,
                                String deepLink) throws Exception {
        Method method = GmailApiClient.class.getDeclaredMethod("mimeRaw", String.class,
            String.class, String.class, String.class, String.class, String.class, String.class);
        method.setAccessible(true);
        String raw = (String) method.invoke(client, "Trung tâm Ánh Dương",
            "sender@example.test", "teacher@example.test", "Thông báo lương",
            text, html, deepLink);
        byte[] decoded = Base64.getUrlDecoder().decode(raw.getBytes(StandardCharsets.UTF_8));
        return new MimeMessage(Session.getInstance(new Properties()), new ByteArrayInputStream(decoded));
    }

    private GmailProperties properties() {
        return new GmailProperties(false, "", "", "", "", Duration.ofMinutes(10),
            Duration.ofHours(72), Duration.ofSeconds(10), "https://example.test/auth",
            "https://example.test/token", "https://example.test/userinfo",
            "https://example.test/send", 1);
    }
}
