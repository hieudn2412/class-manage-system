package com.classops.backend.common;

import java.util.List;

public record PageResponse<T>(
    List<T> items,
    int page,
    int pageSize,
    long totalItems,
    int totalPages
) {
    public static <T> PageResponse<T> of(List<T> items, int page, int pageSize, long totalItems) {
        int pages = pageSize == 0 ? 0 : (int) Math.ceil((double) totalItems / pageSize);
        return new PageResponse<>(List.copyOf(items), page, pageSize, totalItems, pages);
    }
}
