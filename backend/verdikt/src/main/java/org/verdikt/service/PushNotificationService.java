package org.verdikt.service;

import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.SendResponse;
import org.springframework.stereotype.Service;
import org.verdikt.entity.UserPushToken;
import org.verdikt.repository.UserPushTokenRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class PushNotificationService {

    private final UserPushTokenRepository tokenRepository;

    public PushNotificationService(UserPushTokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    public String sendToToken(String token, String title, String body, Map<String, String> data) throws FirebaseMessagingException {
        Message.Builder builder = Message.builder()
                .setToken(token)
                .setNotification(Notification.builder().setTitle(title).setBody(body).build());
        if (data != null && !data.isEmpty()) {
            builder.putAllData(data);
        }
        return FirebaseMessaging.getInstance().send(builder.build());
    }

    public PushBatchResult sendToTokens(List<UserPushToken> rows, String title, String body, Map<String, String> data) throws FirebaseMessagingException {
        if (rows == null || rows.isEmpty()) {
            return new PushBatchResult(0, 0, 0);
        }
        int success = 0;
        int failed = 0;
        int deactivated = 0;

        for (int start = 0; start < rows.size(); start += 500) {
            int end = Math.min(start + 500, rows.size());
            List<UserPushToken> batchRows = rows.subList(start, end);
            List<String> tokens = new ArrayList<>();
            for (UserPushToken r : batchRows) {
                if (r != null && r.isActive() && r.getFcmToken() != null && !r.getFcmToken().isBlank()) {
                    tokens.add(r.getFcmToken());
                }
            }
            if (tokens.isEmpty()) {
                continue;
            }
            MulticastMessage.Builder builder = MulticastMessage.builder()
                    .addAllTokens(tokens)
                    .setNotification(Notification.builder().setTitle(title).setBody(body).build());
            if (data != null && !data.isEmpty()) {
                builder.putAllData(data);
            }
            BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(builder.build());
            success += response.getSuccessCount();
            failed += response.getFailureCount();

            List<SendResponse> rs = response.getResponses();
            for (int i = 0; i < rs.size(); i++) {
                SendResponse item = rs.get(i);
                if (item == null || item.isSuccessful()) continue;
                FirebaseMessagingException ex = item.getException();
                String code = ex != null && ex.getMessagingErrorCode() != null ? ex.getMessagingErrorCode().name() : "";
                if (isInvalidTokenCode(code)) {
                    String badToken = tokens.get(i);
                    tokenRepository.findByFcmToken(badToken).ifPresent(t -> {
                        if (t.isActive()) {
                            t.setActive(false);
                            t.setUpdatedAt(Instant.now());
                            tokenRepository.save(t);
                        }
                    });
                    deactivated++;
                }
            }
        }
        return new PushBatchResult(success, failed, deactivated);
    }

    private boolean isInvalidTokenCode(String code) {
        return "UNREGISTERED".equals(code)
                || "INVALID_ARGUMENT".equals(code)
                || "SENDER_ID_MISMATCH".equals(code);
    }

    public record PushBatchResult(int successCount, int failureCount, int deactivatedTokens) {}
}
