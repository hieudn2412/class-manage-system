# Ma trận truy vết vertical slice

| API / use case | SRS | Business rule / decision | Flow / wireframe | Frontend consumer |
|---|---|---|---|---|
| `POST /platform/auth/login` | FR-TEN-001–004, FR-IAM-005 | DEC-049, scope PLATFORM | FL-01/02/04 / WF-02 | `authRepository.platformLogin` |
| `GET/POST/PATCH /platform/tenants*` | FR-TEN-001–004 | DEC-049, optimistic version, platform audit | FL-04/14 / WF-02 | `managementRepository` |
| `GET/POST/PATCH /accounts*` | FR-IAM-001/002/004/006/008, FR-PPL-001–004 | DEC-049, tenant isolation, last-admin/self guard | FL-02/04/14 / WF-09/10 | `managementRepository` |
| `POST /platform/auth/login` | FR-TEN-001–004, FR-IAM-005 | DEC-049, scope PLATFORM | FL-01/02/04 / WF-02 | `authRepository.platformLogin` |
| `GET/POST/PATCH /platform/tenants*` | FR-TEN-001–004 | DEC-049, optimistic version, platform audit | FL-04/14 / WF-02 | `managementRepository` |
| `GET/POST/PATCH /accounts*` | FR-IAM-001/002/004/006/008, FR-PPL-001–004 | DEC-049, tenant isolation, last-admin/self guard | FL-02/04/14 / WF-09/10 | `managementRepository` |
| `POST /auth/login` | FR-IAM-003, FR-IAM-005 | DEC-011, BR-TEN-001 | FL-04 / WF-01 | `authRepository.login` |
| `POST /auth/forgot-password` | FR-IAM-004 | DEC-011 | FL-04 / WF-01 | `authRepository.forgotPassword` |
| `POST /auth/change-password` | FR-IAM-003, FR-IAM-007 | DEC-008, DEC-011 | FL-04 / WF-01 | `authRepository.changePassword` |
| `GET /dashboard` | FR-RPT-001, FR-RPT-006 | BR-TEN-001 | FL-08/14 / WF-03 | `dashboardRepository.getManagementDashboard` |
| `GET /class-scheduling/options` | FR-CLS-001, FR-CLS-003 | BR-TEN-001, BR-SCH-001 | FL-05 / WF-05 | `classRepository.getSchedulingOptions` |
| `GET /students` | FR-CLS-002, FR-ENR-001 | DEC-039: chỉ quản lý thêm HS | FL-05 / WF-05 | `classRepository.listStudents` |
| `POST/PUT /classes` | FR-CLS-001–003 | BR-AUD-001, DEC-046 | FL-05 / WF-05 | `createDraft`, `updateDraft` |
| `POST /class-scheduling/previews` | FR-CLS-003–005 | BR-SCH-001/002 | FL-05 / WF-05 | `previewSchedule` |
| `POST /classes/{id}/publish` | FR-CLS-004–006, FR-ENR-003 | BR-ENR-001, BR-AUD-001 | FL-05/06 / WF-05 | `publishClass` |
| `GET/POST /classes/{id}/enrollments` | FR-ENR-001–005/007 | DEC-050/051, BR-ENR-003–005 | FL-06 / WF-06 | `lifecycleRepository.enrollments/addEnrollments` |
| `GET /classes/{id}/enrollment-candidates` | FR-ENR-001/007 | DEC-043/051, tenant isolation | FL-06 / WF-06 | `lifecycleRepository.candidates` |
| `PATCH /classes/{id}/enrollments/{enrollmentId}` | FR-ENR-002/005 | DEC-050/051, exclusive end date | FL-06 / WF-06 | `lifecycleRepository.endEnrollment` |
| `PATCH /classes/{id}/status` | FR-CLS-010–012 | DEC-051/052, optimistic version | FL-06 / WF-06 | `lifecycleRepository.changeStatus` |
| `GET /students/me/classes*` | FR-ENR-006/008/009 | DEC-050/052, `VIEW_OWN_LEARNING` | FL-06/09 / WF-24 | `lifecycleRepository.student*` |
| `GET /schedules/management` | FR-CLS-006 | BR-TEN-001 | FL-07 / WF-07 | `getManagementSchedule` |
| `GET /schedules/me` | FR-TCH-002 | BR-TEN-001 | FL-07 / WF-18 | `getOwnSchedule` |
| `POST/PATCH /sessions/{id}/schedule*` | FR-SES-001/002 | BR-SCH-001/002, DEC-046 | FL-07 / WF-07 | `previewSessionSchedule`, `updateSessionSchedule` |
| `POST /sessions/{id}/substitution-previews`, `/substitutions`, `/makeup-previews`, `/cancellations`, `/makeups` | FR-SES-003/004, FR-PAY-009, FR-NTF-001 | DEC-015/016/017/053, BR-AUD-001 | FL-07 / WF-07, WF-08, WF-20 | `SessionMutationModal`, `scheduleRepository.*FL07` |
| `GET /teachers/me/dashboard` | FR-SES-005, FR-RPT-005 | DEC-018/019 | FL-08 / WF-17 | `teachingRepository.getDashboard` |
| `GET /teachers/me/classes` | FR-CLS-013 | DEC-044, BR-TEN-001 | FL-09 / WF-19 | `teachingRepository.getClasses` |
| `GET /teachers/me/classes/{id}/sessions` | FR-CLS-014, FR-SES-014 | DEC-044/045 | FL-09 / WF-26 | `teachingRepository.getClassSessions` |
| `GET /sessions/{id}` | FR-SES-009–017 | DEC-043/045/047 | FL-08/09 / WF-20, WF-27 | `teachingRepository.getSession` |
| `POST /sessions/{id}/check-ins` | FR-SES-005/006 | DEC-018/046 | FL-08 / WF-17, WF-20 | `teachingRepository.checkIn` |
| `PATCH /sessions/{id}/pedagogical-record` | FR-SES-009–013 | BR-ATT-001/002, DEC-047 | FL-09 / WF-20, WF-27 | `savePedagogicalRecord` |
| `POST/PUT /sessions/{id}/students/{studentId}/test-results*` | FR-SES-017 | DEC-045 | FL-09/14 / WF-27 | `createTestResult`, `updateTestResult` |
| `POST /sessions/{id}/verification-decisions` | FR-SES-008 | DEC-019/047/048 | FL-08/12 / WF-08, WF-20 | `decideVerification` |
| `GET/POST/PATCH /classes/{id}/hourly-rates*` | FR-PAY-001/004 | Lịch sử hiệu lực, optimistic version, không xóa mức đã dùng | FL-12 / WF-05, WF-15 | `salaryRepository.hourlyRates/createHourlyRate/updateHourlyRate` |
| `PATCH /sessions/{id}/completion-correction` | FR-PAY-004/007/009 | Reconcile idempotent, audit before/after, Asia/Ho_Chi_Minh | FL-12 / WF-08, WF-15 | `CompletionCorrectionModal` |
| `GET /salary/payroll*` | FR-PAY-002–009, FR-RPT-004 | Kỳ là projection trực tiếp, không snapshot/khóa | FL-12 / WF-15 | `SalaryPayrollPage`, `SalaryTeacherDetailPage` |
| `POST/PATCH /salary/adjustments*` | FR-PAY-005/007 | Số có dấu, version, lý do sửa, không xóa | FL-12 / WF-15 | `SalaryTransactionModal` |
| `POST/PATCH /salary/payments*` | FR-PAY-006/007 | Nhiều đợt, ngày trả riêng kỳ lương, xác nhận trả vượt | FL-12 / WF-15 | `SalaryTransactionModal` |
| `GET /teachers/me/salary` | FR-PAY-008 | Chỉ teacher profile của JWT, `VIEW_OWN_SALARY` | FL-12 / WF-22 | `MySalaryPage` |
| `GET /salary/payroll/export` | FR-RPT-004 | Tenant/RBAC/bộ lọc hiện tại, XLSX 2 sheet | FL-12 / WF-15 | `SalaryPayrollPage` |
| `GET /finance/salary-summary` | FR-RPT-002 | Phân biệt kỳ công nợ và dòng tiền theo `paid_at` | FL-12 / WF-13 | Consumer WF-13 sau FL-11 |
| `POST /uploads/staging`, `GET /files/{id}/content` | FR-HW-002/004, FR-MAT-001/004, NFR-SEC | DEC-055/056, private files, ClamAV, quota, Range | FL-10 / WF-21/24/25/27 | `learningContentRepository.upload`, file viewers |
| `GET/POST/PATCH /classes/{id}/homeworks`, `/homeworks/{id}/publish|close|reopen` | FR-HW-001–008 | DEC-054/057, idempotency, optimistic version, audit/notification | FL-10 / WF-21/27 | `ClassHomeworksPanel`, `HomeworkDetailPage` |
| `POST /students/me/homeworks/{id}/submissions` | FR-HW-004–006 | 10 images/attempt, immutable attempts, late stamp at submit time | FL-10 / WF-25 | `HomeworkDetailPage` |
| `POST /homeworks/{id}/submissions/{submissionId}/reviews` | FR-HW-007/008 | Current attempt only, status/comment/files, no score | FL-10 / WF-21/27 | `HomeworkDetailPage` |
| `GET/POST/PATCH/DELETE /classes/{id}/materials`, `/materials/{id}` | FR-MAT-001–004 | DEC-055/056/057, active enrollment access, physical delete on replace/remove | FL-10 / WF-24/27 | `ClassMaterialsPanel` |
| `GET/PATCH /notifications*` | FR-NTF-001, DEC-037 | In-app + tenant Gmail outbox retry, no periodic reminders | FL-14 base / FL-10 events | `NotificationBell`, `NotificationsPage` |
| `GET/POST/DELETE /tenant-email-connection*`, `GET /oauth/google/gmail/callback` | FR-NTF-001, NFR-SEC | DEC-058, Gmail OAuth tenant, encrypted refresh token, no SMTP global | FL-10.1 / settings email | `tenantEmailRepository`, `TenantEmailSettingsPage` |
| `GET /storage/usage`, `GET/PATCH /platform/tenants/{id}/quota` | NFR-OPS, NFR-SEC | Default 50GB tenant quota, Super Admin manages | FL-10 ops | `PlatformQuotaPage` |
| `GET/POST/PATCH /classes/{id}/hourly-rates*` | FR-PAY-001/004 | Lịch sử hiệu lực, optimistic version, không xóa mức đã dùng | FL-12 / WF-05, WF-15 | `salaryRepository.hourlyRates/createHourlyRate/updateHourlyRate` |
| `PATCH /sessions/{id}/completion-correction` | FR-PAY-004/007/009 | Reconcile idempotent, audit before/after, Asia/Ho_Chi_Minh | FL-12 / WF-08, WF-15 | `CompletionCorrectionModal` |
| `GET /salary/payroll*` | FR-PAY-002–009, FR-RPT-004 | Kỳ là projection trực tiếp, không snapshot/khóa | FL-12 / WF-15 | `SalaryPayrollPage`, `SalaryTeacherDetailPage` |
| `POST/PATCH /salary/adjustments*` | FR-PAY-005/007 | Số có dấu, version, lý do sửa, không xóa | FL-12 / WF-15 | `SalaryTransactionModal` |
| `POST/PATCH /salary/payments*` | FR-PAY-006/007 | Nhiều đợt, ngày trả riêng kỳ lương, xác nhận trả vượt | FL-12 / WF-15 | `SalaryTransactionModal` |
| `GET /teachers/me/salary` | FR-PAY-008 | Chỉ teacher profile của JWT, `VIEW_OWN_SALARY` | FL-12 / WF-22 | `MySalaryPage` |
| `GET /salary/payroll/export` | FR-RPT-004 | Tenant/RBAC/bộ lọc hiện tại, XLSX 2 sheet | FL-12 / WF-15 | `SalaryPayrollPage` |
| `GET /finance/salary-summary` | FR-RPT-002 | Phân biệt kỳ công nợ và dòng tiền theo `paid_at` | FL-12 / WF-13 | Consumer WF-13 sau FL-11 |

Mỗi API có validation/error contract trong OpenAPI; acceptance criteria chi tiết nằm ở
SRS. Test engine và integration test liên kết trực tiếp các trường hợp ngày nghỉ, tenant,
xung đột, idempotency, transaction publish, khóa roster, completion và salary accrual.
