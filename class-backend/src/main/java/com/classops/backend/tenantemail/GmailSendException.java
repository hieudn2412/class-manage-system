package com.classops.backend.tenantemail;

import java.time.Duration;

public class GmailSendException extends RuntimeException {
    private final String code;
    private final boolean retryable;
    private final boolean reauthRequired;
    private final Duration retryAfter;

    public GmailSendException(String code, String message, boolean retryable,
                              boolean reauthRequired, Duration retryAfter) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.reauthRequired = reauthRequired;
        this.retryAfter = retryAfter;
    }

    public String code() {
        return code;
    }

    public boolean retryable() {
        return retryable;
    }

    public boolean reauthRequired() {
        return reauthRequired;
    }

    public Duration retryAfter() {
        return retryAfter;
    }
}
