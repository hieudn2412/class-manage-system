package com.classops.backend.scheduling;

import com.classops.backend.common.PageResponse;
import com.classops.backend.scheduling.SchedulingDtos.ClassDetail;
import com.classops.backend.scheduling.SchedulingDtos.ClassDraftInput;
import com.classops.backend.scheduling.SchedulingDtos.ClassDraftRecord;
import com.classops.backend.scheduling.SchedulingDtos.ClassListItem;
import com.classops.backend.scheduling.SchedulingDtos.PublishClassInput;
import com.classops.backend.scheduling.SchedulingDtos.SchedulePreview;
import com.classops.backend.scheduling.SchedulingDtos.StudentOption;
import com.classops.backend.scheduling.SchedulingDtos.TeacherOption;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Class scheduling")
@SecurityRequirement(name = "bearerAuth")
public class ClassSchedulingController {
    private final ClassSchedulingService service;

    public ClassSchedulingController(ClassSchedulingService service) {
        this.service = service;
    }

    @GetMapping("/class-scheduling/options")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES') or hasAuthority('VIEW_MANAGEMENT_SCHEDULE')")
    @Operation(summary = "Get tenant-scoped teacher and room options")
    SchedulingDtos.SchedulingOptions options() {
        return service.options();
    }

    @GetMapping("/students")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    PageResponse<StudentOption> students(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return service.students(search, page, pageSize);
    }

    @PostMapping("/class-scheduling/previews")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    @Operation(summary = "Generate a non-authoritative class schedule preview")
    SchedulePreview preview(@Valid @RequestBody ClassDraftInput input) {
        return service.preview(input);
    }

    @GetMapping("/classes/teachers")
    @PreAuthorize("hasAuthority('VIEW_CLASSES')")
    List<TeacherOption> teachers() {
        return service.teachers();
    }

    @GetMapping("/classes")
    @PreAuthorize("hasAuthority('VIEW_CLASSES')")
    PageResponse<ClassListItem> classes(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(required = false) String month,
        @RequestParam(defaultValue = "") String status,
        @RequestParam(required = false) UUID teacherId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(defaultValue = "name") String sort
    ) {
        return service.classes(search, month, status, teacherId, page, pageSize, sort);
    }

    @GetMapping("/classes/{classId}")
    @PreAuthorize("hasAuthority('VIEW_CLASSES')")
    ClassDetail detail(@PathVariable UUID classId) {
        return service.detail(classId);
    }

    @GetMapping("/classes/{classId}/draft")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    ClassDraftRecord draft(@PathVariable UUID classId) {
        return service.draft(classId);
    }

    @PostMapping("/classes")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    ClassDraftRecord create(@Valid @RequestBody ClassDraftInput input) {
        return service.createDraft(input);
    }

    @PutMapping("/classes/{classId}")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    ClassDraftRecord update(@PathVariable UUID classId,
                            @Valid @RequestBody ClassDraftInput input) {
        return service.updateDraft(classId, input);
    }

    @PostMapping("/classes/{classId}/publish")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    ClassDetail publish(
        @PathVariable UUID classId,
        @Valid @RequestBody PublishClassInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.publish(classId, input, idempotencyKey);
    }
}
