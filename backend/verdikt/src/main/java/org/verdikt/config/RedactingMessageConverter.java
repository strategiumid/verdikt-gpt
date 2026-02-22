package org.verdikt.config;

import ch.qos.logback.classic.pattern.MessageConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

import java.util.regex.Pattern;

/**
 * Маскирует чувствительные данные в лог-сообщениях: пароли, токены, ключи,
 * заголовки Authorization/Cookie, зашифрованные фрагменты — не попадают в логи даже частично.
 */
public class RedactingMessageConverter extends MessageConverter {

    private static final String MASK = "***";
    private static final Pattern[] SENSITIVE = new Pattern[] {
        Pattern.compile("(password|passwd|pwd|secret|token|api[_-]?key|auth)\\s*[:=]\\s*[^\\s,}\\]]+", Pattern.CASE_INSENSITIVE),
        Pattern.compile("Bearer\\s+[^\\s]+", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(Authorization|Cookie)\\s*[:=]\\s*[^\\s,}\\]]+", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(verdikt_token|jwt)=[^\\s,;]+", Pattern.CASE_INSENSITIVE),
        Pattern.compile("[a-zA-Z0-9_-]{20,}\\.([a-zA-Z0-9_-]+\\.){2}[a-zA-Z0-9_-]+") // JWT-like
    };

    @Override
    public String convert(ILoggingEvent event) {
        String msg = super.convert(event);
        if (msg == null || msg.isEmpty()) return msg;
        for (Pattern p : SENSITIVE) {
            msg = p.matcher(msg).replaceAll(MASK);
        }
        return msg;
    }
}
