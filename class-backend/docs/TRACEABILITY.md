# Ma trận truy vết vertical slice

| API / use case | SRS | Business rule / decision | Flow / wireframe | Frontend consumer |
|---|---|---|---|---|
| `POST /auth/login` | FR-IAM-003, FR-IAM-005 | DEC-011, BR-TEN-001 | FL-04 / WF-01 | `authRepository.login` |
| `POST /auth/forgot-password` | FR-IAM-004 | DEC-011 | FL-04 / WF-01 | `authRepository.forgotPassword` |
| `POST /auth/change-password` | FR-IAM-003, FR-IAM-007 | DEC-008, DEC-011 | FL-04 / WF-01 | `authRepository.changePassword` |
| `GET /dashboard` | FR-RPT-001, FR-RPT-006 | BR-TEN-001 | FL-08/14 / WF-03 | `dashboardRepository.getManagementDashboard` |
| `GET /class-scheduling/options` | FR-CLS-001, FR-CLS-003 | BR-TEN-001, BR-SCH-001 | FL-05 / WF-05 | `classRepository.getSchedulingOptions` |
| `GET /students` | FR-CLS-002, FR-ENR-001 | DEC-039: chỉ quản lý thêm HS | FL-05 / WF-05 | `classRepository.listStudents` |
| `POST/PUT /classes` | FR-CLS-001–003 | BR-AUD-001, DEC-046 | FL-05 / WF-05 | `createDraft`, `updateDraft` |
| `POST /class-scheduling/previews` | FR-CLS-003–005 | BR-SCH-001/002 | FL-05 / WF-05 | `previewSchedule` |
| `POST /classes/{id}/publish` | FR-CLS-004–006, FR-ENR-003 | BR-ENR-001, BR-AUD-001 | FL-05/06 / WF-05 | `publishClass` |
| `GET /schedules/management` | FR-CLS-006 | BR-TEN-001 | FL-07 / WF-07 | `getManagementSchedule` |
| `GET /schedules/me` | FR-TCH-002 | BR-TEN-001 | FL-07 / WF-18 | `getOwnSchedule` |
| `POST/PATCH /sessions/{id}/schedule*` | FR-SES-001/002 | BR-SCH-001/002, DEC-046 | FL-07 / WF-07 | `previewSessionSchedule`, `updateSessionSchedule` |
| `GET /teachers/me/dashboard` | FR-SES-005, FR-RPT-005 | DEC-018/019 | FL-08 / WF-17 | `teachingRepository.getDashboard` |
| `GET /teachers/me/classes` | FR-CLS-013 | DEC-044, BR-TEN-001 | FL-09 / WF-19 | `teachingRepository.getClasses` |
| `GET /teachers/me/classes/{id}/sessions` | FR-CLS-014, FR-SES-014 | DEC-044/045 | FL-09 / WF-26 | `teachingRepository.getClassSessions` |
| `GET /sessions/{id}` | FR-SES-009–017 | DEC-043/045/047 | FL-08/09 / WF-20, WF-27 | `teachingRepository.getSession` |
| `POST /sessions/{id}/check-ins` | FR-SES-005/006 | DEC-018/046 | FL-08 / WF-17, WF-20 | `teachingRepository.checkIn` |
| `PATCH /sessions/{id}/pedagogical-record` | FR-SES-009–013 | BR-ATT-001/002, DEC-047 | FL-09 / WF-20, WF-27 | `savePedagogicalRecord` |
| `POST/PUT /sessions/{id}/students/{studentId}/test-results*` | FR-SES-017 | DEC-045 | FL-09/14 / WF-27 | `createTestResult`, `updateTestResult` |
| `POST /sessions/{id}/verification-decisions` | FR-SES-008 | DEC-019/047/048 | FL-08/12 / WF-08, WF-20 | `decideVerification` |

Mỗi API có validation/error contract trong OpenAPI; acceptance criteria chi tiết nằm ở
SRS. Test engine và integration test liên kết trực tiếp các trường hợp ngày nghỉ, tenant,
xung đột, idempotency, transaction publish, khóa roster, completion và salary accrual.
