package org.verdikt.service.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class ResendEmailSender implements EmailSender {

    @Value("${resend.api-key:}")
    private String apiKey;

    @Value("${app.email.from:no-reply@yourdomain.kz}")
    private String from;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public void sendVerificationCode(String toEmail, String code, String idempotencyKey) {
        if (apiKey == null || apiKey.isBlank()) {
            return;
        }
        String html = """
            <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">
              <h2>Подтверждение email</h2>
              <p>Ваш код подтверждения:</p>
              <div style="font-size:28px;font-weight:bold;letter-spacing:4px;">%s</div>
              <p>Код действует 5 минут.</p>
              <p>Если это были не вы, просто проигнорируйте письмо.</p>
            </div>
            """.formatted(code);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        headers.set("Idempotency-Key", idempotencyKey);

        Map<String, Object> body = Map.of(
                "from", from,
                "to", List.of(toEmail),
                "subject", "Код подтверждения",
                "html", html
        );
        HttpEntity<Map<String, Object>> req = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange("https://api.resend.com/emails", HttpMethod.POST, req, String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("EMAIL_SEND_FAILED");
        }
    }
}
