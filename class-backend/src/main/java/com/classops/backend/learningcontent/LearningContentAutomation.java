package com.classops.backend.learningcontent;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class LearningContentAutomation {
    private final LearningContentService service;

    public LearningContentAutomation(LearningContentService service) {
        this.service = service;
    }

    @Scheduled(fixedDelayString = "${app.teaching.scheduler-delay-ms:30000}")
    public void closeContentForInactiveClasses() {
        service.closeOpenHomeworksForInactiveClasses();
    }
}
