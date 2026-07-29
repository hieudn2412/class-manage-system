package com.classops.backend.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> api(ApiException ex, HttpServletRequest request) {
        return problem(ex.status(), ex.code(), ex.getMessage(), ex.details(), Map.of(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex,
                                                   HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
            "Dữ liệu gửi lên chưa hợp lệ.", Map.of(), fields, request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, Object>> denied(AccessDeniedException ex, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "FORBIDDEN",
            "Bạn không có quyền thực hiện thao tác này.", Map.of(), Map.of(), request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, Object>> unreadable(HttpMessageNotReadableException ex,
                                                   HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "INVALID_JSON",
            "JSON không hợp lệ hoặc có trường không được API hỗ trợ.",
            Map.of(), Map.of(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled request failure for {}", request.getRequestURI(), ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
            "Hệ thống đang gặp lỗi. Vui lòng thử lại.", Map.of(), Map.of(), request);
    }

    private ResponseEntity<Map<String, Object>> problem(
        HttpStatus status,
        String code,
        String message,
        Map<String, Object> details,
        Map<String, String> fieldErrors,
        HttpServletRequest request
    ) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "https://classops.vn/problems/" + code.toLowerCase().replace('_', '-'));
        body.put("title", status.getReasonPhrase());
        body.put("status", status.value());
        body.put("detail", message);
        body.put("instance", request.getRequestURI());
        body.put("code", code);
        body.put("message", message);
        body.put("fieldErrors", fieldErrors);
        body.put("details", details);
        HttpHeaders headers = new HttpHeaders();
        Object retryAfter = details.get("retryAfterSeconds");
        if (retryAfter != null) {
            body.put("retryAfterSeconds", retryAfter);
            headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfter));
        }
        body.put("timestamp", Instant.now().toString());
        body.put("traceId", MDC.get("traceId"));
        return ResponseEntity.status(status)
            .headers(headers)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .body(body);
    }
}
