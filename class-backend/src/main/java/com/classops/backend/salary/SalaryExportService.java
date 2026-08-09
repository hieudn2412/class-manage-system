package com.classops.backend.salary;

import com.classops.backend.salary.SalaryDtos.PayrollPage;
import com.classops.backend.salary.SalaryDtos.PayrollTeacherRow;
import com.classops.backend.salary.SalaryDtos.SalaryAccrualLine;
import com.classops.backend.salary.SalaryDtos.SalaryAdjustmentView;
import com.classops.backend.salary.SalaryDtos.SalaryPaymentView;
import com.classops.backend.salary.SalaryDtos.TeacherPayrollDetail;
import com.classops.backend.security.CurrentActor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Service
public class SalaryExportService {
    private final SalaryService salaryService;
    private final CurrentActor actor;
    private final JdbcClient jdbc;
    private final Clock clock;

    public SalaryExportService(SalaryService salaryService, CurrentActor actor,
                               JdbcClient jdbc, Clock clock) {
        this.salaryService = salaryService;
        this.actor = actor;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public byte[] export(YearMonth month, String search, String status, String sort) {
        List<PayrollTeacherRow> teachers = new ArrayList<>();
        int page = 1;
        PayrollPage batch;
        do {
            batch = salaryService.payroll(month, search, status, page++, 100, sort);
            teachers.addAll(batch.teachers().items());
        } while (batch.teachers().page() < batch.teachers().totalPages());

        String tenantName = jdbc.sql("SELECT name FROM tenants WHERE id=:tenantId")
            .param("tenantId", actor.tenantId()).query(String.class).single();
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            CellStyle header = headerStyle(workbook);
            CellStyle money = moneyStyle(workbook);
            summarySheet(workbook, header, money, tenantName, month, search, status, teachers);
            detailSheet(workbook, header, money, month, teachers);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể tạo file bảng lương.", exception);
        }
    }

    private void summarySheet(XSSFWorkbook workbook, CellStyle header, CellStyle money,
                              String tenantName, YearMonth month, String search, String status,
                              List<PayrollTeacherRow> teachers) {
        Sheet sheet = workbook.createSheet("Tổng hợp");
        meta(sheet, tenantName, month, search, status);
        int rowNumber = 5;
        Row headings = sheet.createRow(rowNumber++);
        String[] columns = {"Giáo viên", "Số buổi", "Tổng phút", "Tiền dạy",
            "Cộng/trừ", "Phải trả", "Đã trả", "Còn lại", "Trạng thái"};
        writeRow(headings, header, columns);
        for (PayrollTeacherRow teacher : teachers) {
            Row row = sheet.createRow(rowNumber++);
            text(row, 0, teacher.teacherName());
            number(row, 1, teacher.sessionCount());
            number(row, 2, teacher.totalMinutes());
            money(row, 3, teacher.accrued(), money);
            money(row, 4, teacher.adjustments(), money);
            money(row, 5, teacher.due(), money);
            money(row, 6, teacher.paid(), money);
            money(row, 7, teacher.outstanding(), money);
            text(row, 8, teacher.status().name());
        }
        autoSize(sheet, columns.length);
        sheet.createFreezePane(0, 6);
    }

    private void detailSheet(XSSFWorkbook workbook, CellStyle header, CellStyle money,
                             YearMonth month, List<PayrollTeacherRow> teachers) {
        Sheet sheet = workbook.createSheet("Chi tiết");
        int rowNumber = 0;
        String[] columns = {"Loại", "Giáo viên", "Kỳ", "Ngày", "Lớp / tham chiếu",
            "Buổi", "Phút", "Đơn giá", "Số tiền", "Trạng thái / lý do"};
        writeRow(sheet.createRow(rowNumber++), header, columns);
        for (PayrollTeacherRow teacher : teachers) {
            TeacherPayrollDetail detail = salaryService.teacherPayroll(teacher.teacherId(), month);
            for (SalaryAccrualLine line : detail.accruals()) {
                Row row = sheet.createRow(rowNumber++);
                text(row, 0, "ACCRUAL"); text(row, 1, teacher.teacherName());
                text(row, 2, month.toString()); text(row, 3, line.sessionDate().toString());
                text(row, 4, line.classCode() + " · " + line.className());
                number(row, 5, line.ordinal()); number(row, 6, line.scheduledMinutes());
                money(row, 7, line.hourlyRate(), money); money(row, 8, line.amount(), money);
                text(row, 9, line.status().name());
            }
            for (SalaryAdjustmentView adjustment : detail.adjustments()) {
                Row row = sheet.createRow(rowNumber++);
                text(row, 0, "ADJUSTMENT"); text(row, 1, teacher.teacherName());
                text(row, 2, month.toString()); text(row, 3, adjustment.createdAt().toLocalDate().toString());
                text(row, 4, "Điều chỉnh"); money(row, 8, adjustment.amount(), money);
                text(row, 9, adjustment.reason());
            }
            for (SalaryPaymentView payment : detail.payments()) {
                Row row = sheet.createRow(rowNumber++);
                text(row, 0, "PAYMENT"); text(row, 1, teacher.teacherName());
                text(row, 2, month.toString()); text(row, 3, payment.paidAt().toString());
                text(row, 4, payment.reference() == null ? payment.method().name() : payment.reference());
                money(row, 8, payment.amount(), money);
                text(row, 9, payment.overpaymentReason() == null ? payment.method().name()
                    : "Trả vượt: " + payment.overpaymentReason());
            }
        }
        autoSize(sheet, columns.length);
        sheet.createFreezePane(0, 1);
    }

    private void meta(Sheet sheet, String tenantName, YearMonth month,
                      String search, String status) {
        text(sheet.createRow(0), 0, "BẢNG LƯƠNG GIÁO VIÊN");
        text(sheet.createRow(1), 0, "Trung tâm: " + tenantName);
        text(sheet.createRow(2), 0, "Kỳ lương: " + month);
        text(sheet.createRow(3), 0, "Xuất lúc: " + OffsetDateTime.now(clock));
        text(sheet.createRow(4), 0, "Bộ lọc: tìm kiếm=" + nullSafe(search)
            + ", trạng thái=" + nullSafe(status));
    }

    private CellStyle headerStyle(XSSFWorkbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private CellStyle moneyStyle(XSSFWorkbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0\" ₫\";[Red]-#,##0\" ₫\""));
        return style;
    }

    private void writeRow(Row row, CellStyle style, String[] values) {
        for (int index = 0; index < values.length; index++) {
            Cell cell = row.createCell(index);
            cell.setCellValue(values[index]);
            cell.setCellStyle(style);
        }
    }

    private void text(Row row, int column, String value) {
        row.createCell(column).setCellValue(value == null ? "" : value);
    }

    private void number(Row row, int column, long value) {
        row.createCell(column).setCellValue(value);
    }

    private void money(Row row, int column, BigDecimal value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value.doubleValue());
        cell.setCellStyle(style);
    }

    private void autoSize(Sheet sheet, int columns) {
        for (int index = 0; index < columns; index++) {
            sheet.autoSizeColumn(index);
            sheet.setColumnWidth(index, Math.min(sheet.getColumnWidth(index) + 700, 15000));
        }
    }

    private String nullSafe(String value) {
        return value == null || value.isBlank() ? "Tất cả" : value;
    }
}
