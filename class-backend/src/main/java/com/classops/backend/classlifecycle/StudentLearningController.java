package com.classops.backend.classlifecycle;

import com.classops.backend.classlifecycle.LifecycleDtos.StudentClassDetail;
import com.classops.backend.classlifecycle.LifecycleDtos.StudentClassItem;
import com.classops.backend.classlifecycle.LifecycleDtos.StudentSessionItem;
import com.classops.backend.common.PageResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/students/me/classes")
@PreAuthorize("hasAuthority('VIEW_OWN_LEARNING')")
@Tag(name = "Student learning")
@SecurityRequirement(name = "bearerAuth")
public class StudentLearningController {
    private final ClassLifecycleService service;

    public StudentLearningController(ClassLifecycleService service) {
        this.service = service;
    }

    @GetMapping
    PageResponse<StudentClassItem> classes(
        @RequestParam(defaultValue = "All") String access,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return service.studentClasses(access, page, pageSize);
    }

    @GetMapping("/{classId}")
    StudentClassDetail detail(@PathVariable UUID classId) {
        return service.studentClass(classId);
    }

    @GetMapping("/{classId}/sessions")
    PageResponse<StudentSessionItem> sessions(
        @PathVariable UUID classId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return service.studentSessions(classId, page, pageSize);
    }
}
