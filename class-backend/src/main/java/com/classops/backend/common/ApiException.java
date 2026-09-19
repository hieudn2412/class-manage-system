package com.classops.backend.common;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Map<String, Object> details;
    private final Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, Map.of(), Map.of());
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, Object> details) {
        this(status, code, message, details, Map.of());
    }

    public ApiException(HttpStatus status, String code, String message,
                        Map<String, Object> details, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details == null ? Map.of() : Map.copyOf(details);
        this.fieldErrors = fieldErrors == null ? Map.of() : Map.copyOf(fieldErrors);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public Map<String, Object> details() {
        return details;
    }

    public Map<String, String> fieldErrors() {
        return fieldErrors;
    }
}
