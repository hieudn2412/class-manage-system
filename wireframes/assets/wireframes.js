(() => {
  "use strict";

  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

  const actions = (primary, secondary = "Xuất dữ liệu") => `
    <div class="screen-actions">
      ${secondary ? `<button class="button button-secondary" data-action="${secondary}">${secondary}</button>` : ""}
      ${primary ? `<button class="button button-primary" data-action="${primary}">${primary}</button>` : ""}
    </div>`;

  const screenHead = (kicker, title, description, actionHtml = "") => `
    <header class="screen-head">
      <div>
        <span class="eyebrow">${kicker}</span>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      ${actionHtml}
    </header>`;

  const status = (label, type = "muted") => `<span class="status status-${type}">${label}</span>`;

  const metrics = (items) => `
    <div class="grid grid-4">
      ${items.map(([label, value, note, trend = "—"]) => `
        <article class="metric-card">
          <div class="metric-label"><span>${label}</span><span class="trend">${trend}</span></div>
          <div class="metric-value">${value}</div>
          <div class="metric-note">${note}</div>
        </article>`).join("")}
    </div>`;

  const table = (headers, rows, caption = "") => `
    <div class="table-wrap">
      <table>
        ${caption ? `<caption class="table-caption">${caption}</caption>` : ""}
        <thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>`;

  const notice = (title, text, icon = "!") => `
    <div class="notice">
      <span class="notice-icon" aria-hidden="true">${icon}</span>
      <div><strong>${title}</strong><p>${text}</p></div>
    </div>`;

  const field = (label, control, help = "") => `
    <label class="field"><span>${label}</span>${control}${help ? `<small class="field-help">${help}</small>` : ""}</label>`;

  const tabs = (items, active = 0) => `
    <div class="tabs" role="tablist">
      ${items.map((item, index) => `<button class="tab" role="tab" aria-selected="${index === active}" data-tab="${item.id}">${item.label}</button>`).join("")}
    </div>
    ${items.map((item, index) => `<section data-panel="${item.id}" ${index === active ? "" : "hidden"}>${item.content}</section>`).join("")}`;

  const filters = (extra = "") => `
    <div class="toolbar">
      ${field("Tìm kiếm", '<input type="search" placeholder="Tên, mã hoặc từ khóa">')}
      ${field("Trạng thái", '<select><option>Tất cả trạng thái</option><option>Đang hoạt động</option><option>Chờ xử lý</option><option>Đã đóng</option></select>')}
      ${field("Thời gian", '<select><option>Tháng 07/2026</option><option>Tháng 06/2026</option><option>Tùy chọn…</option></select>')}
      ${extra}
      <button class="button button-secondary" data-action="Áp dụng bộ lọc">Lọc</button>
    </div>`;

  const calendar = () => {
    const cells = [
      ["", "Thứ 2 · 20/07", "Thứ 3 · 21/07", "Thứ 4 · 22/07", "Thứ 5 · 23/07", "Thứ 6 · 24/07"],
      ["07:00", "Toán tư duy 4A|GV Lan · P.201", "", "IELTS 6.5|GV Minh · Online", "", "Văn 8B|GV Phương · P.102"],
      ["09:00", "", "Tiếng Anh thiếu nhi|GV Hà · P.201", "", "Toán 7A|2 lớp trùng ca", ""],
      ["14:00", "Văn 9A|GV Phương · P.102", "", "Toán 7A|GV Hùng · P.201", "", "IELTS Speaking|GV Minh · Online"],
      ["19:00", "IELTS 6.5|GV Minh · Online", "Toán tư duy 4A|GV Lan · P.201", "Văn 8B|GV Phương · P.102", "IELTS 6.5|GV Minh · Online", "Toán 7A|GV Hùng · P.201"]
    ];
    return `<div class="calendar" aria-label="Thời khóa biểu tuần">${cells.flatMap((row, r) => row.map((cell, c) => {
      if (r === 0) return `<div class="cal-head">${cell}</div>`;
      if (c === 0) return `<div class="cal-time">${cell}</div>`;
      if (!cell) return "<div></div>";
      const [title, detail] = cell.split("|");
      return `<div><button class="cal-event" data-action="Mở chi tiết buổi"><strong>${title}</strong><small>${detail}</small></button></div>`;
    })).join("")}</div>`;
  };

  const attendanceRows = () => [
    ["Nguyễn Minh Anh", "Có mặt"],
    ["Trần Gia Hân", "Đi muộn"],
    ["Lê Hoàng Nam", "Có mặt"],
    ["Phạm Ngọc Linh", "Vắng phép"],
    ["Đỗ Hải Yến", "Có mặt"]
  ].map(([name, checked]) => `
    <div class="check-row">
      <strong>${name}</strong>
      ${["Có mặt", "Đi muộn", "Về sớm", "Vắng phép", "Vắng KP"].map((s) =>
        `<label><input type="radio" name="${name}" ${checked === s ? "checked" : ""}> ${s}</label>`).join("")}
      <input aria-label="Ghi chú ${name}" placeholder="Ghi chú / nhận xét">
    </div>`).join("");

  const attendanceSelect = (name, selected) => `
    <select aria-label="Trạng thái đi học của ${name}">
      ${["Có mặt", "Đi muộn", "Về sớm", "Vắng có phép", "Vắng không phép"].map((value) =>
        `<option ${value === selected ? "selected" : ""}>${value}</option>`).join("")}
    </select>`;

  const homeworkReviewSelect = (name, selected) => `
    <select aria-label="Trạng thái BTVN của ${name}">
      ${["Chưa nộp", "Đã nộp", "Nộp trễ", "Yêu cầu làm lại", "Đã chữa"].map((value) =>
        `<option ${value === selected ? "selected" : ""}>${value}</option>`).join("")}
    </select>`;

  const screenList = [
    {
      id: "WF-01", role: "platform", group: "Dùng chung", title: "Đăng nhập & mật khẩu",
      requirements: "FR-IAM-003–005", flow: "FL-04",
      render: () => `
        ${screenHead("Truy cập hệ thống", "Đăng nhập an toàn, không làm người dùng đoán", "Một màn hình gom đủ trạng thái đăng nhập, đổi mật khẩu tạm và khôi phục tài khoản.")}
        <div class="grid grid-2">
          <section class="card">
            <span class="eyebrow">Tenant: Ánh Dương</span>
            <h2>Đăng nhập</h2>
            <div class="stack">
              ${field("Tên đăng nhập", '<input value="nguyen.an" autocomplete="username">')}
              ${field("Mật khẩu", '<input type="password" value="••••••••" autocomplete="current-password">')}
              <label><input type="checkbox"> Ghi nhớ trên thiết bị này</label>
              <button class="button button-primary" data-action="Đăng nhập">Đăng nhập</button>
              <button class="button button-quiet" data-action="Quên mật khẩu">Quên mật khẩu?</button>
            </div>
          </section>
          <section class="card">
            <span class="eyebrow">State variants</span>
            <h2>Lần đầu & khôi phục</h2>
            <div class="stack">
              ${notice("Bắt buộc đổi mật khẩu tạm", "Người dùng chỉ truy cập được form đổi mật khẩu trước khi vào hệ thống.", "1")}
              ${notice("Không tiết lộ tài khoản", "Quên mật khẩu luôn trả cùng một thông điệp dù username có tồn tại hay không.", "2")}
              ${notice("Reset thu hồi phiên cũ", "Mật khẩu cũ và mọi phiên đang hoạt động mất hiệu lực.", "3")}
            </div>
          </section>
        </div>`
    },
    {
      id: "WF-02", role: "platform", group: "Nền tảng", title: "Quản trị tenant",
      requirements: "FR-TEN-001–004", flow: "FL-01 · FL-04",
      render: () => `
        ${screenHead("Super Admin", "Các trung tâm trên nền tảng", "Super Admin chỉ quản lý vòng đời tenant và Admin ban đầu; không đi vào dữ liệu nghiệp vụ.", actions("Tạo trung tâm", ""))}
        ${metrics([["Tenant hoạt động", "18", "Tổng cộng 20 tenant", "+2"], ["Đang khóa", "02", "Dữ liệu vẫn được giữ", "—"], ["Tạo tháng này", "03", "Không có gói thuê bao v1", "+1"], ["Sự kiện bảo mật", "01", "Trong 24 giờ gần nhất", "!"]])}
        <br>
        ${filters("")}
        ${table(["Mã tenant", "Trung tâm", "Admin ban đầu", "Ngày tạo", "Trạng thái", "Thao tác"], [
          ["TT-AD", "<strong>Trung tâm Ánh Dương</strong>", "admin.anhduong", "03/02/2026", status("Hoạt động", "success"), '<button class="table-action" data-action="Khóa tenant">Khóa</button>'],
          ["TT-MT", "<strong>Trung tâm Minh Tâm</strong>", "admin.minhtam", "21/03/2026", status("Hoạt động", "success"), '<button class="table-action" data-action="Khóa tenant">Khóa</button>'],
          ["TT-SS", "<strong>Học viện Sao Sáng</strong>", "admin.saosang", "09/06/2026", status("Đã khóa", "danger"), '<button class="table-action" data-action="Mở tenant">Mở lại</button>']
        ], "Tenant registry — không hiển thị dữ liệu lớp/học sinh")}
      `
    },
    {
      id: "WF-03", role: "management", group: "Trung tâm", title: "Dashboard trung tâm",
      requirements: "FR-RPT-001 · FR-NTF", flow: "FL-08 · FL-14",
      render: () => `
        ${screenHead("Thứ Sáu, 24/07/2026", "Chào buổi sáng, Nguyễn An", "Bản đồ vận hành hôm nay: việc cần xử lý trước, số liệu sau.", actions("Tạo lớp mới", "In báo cáo"))}
        ${metrics([["Lớp có buổi hôm nay", "12", "18 buổi / 9 phòng", "+3"], ["Chờ xác nhận đã dạy", "02", "Thiếu check-in", "!"], ["Buổi thiếu hồ sơ", "05", "3 thiếu record · 2 thiếu điểm danh", "!"], ["Chuyên cần tháng", "91,4%", "1.248 lượt học", "+2,1%"]])}
        <br>
        <div class="grid grid-3">
          <section class="card span-2">
            <h2>Việc cần xử lý</h2>
            <ul class="list">
              <li class="list-item"><div><strong>Buổi IELTS 6.5 chưa có check-in</strong><p>23/07 · 19:00–21:00 · GV Trần Quốc Minh</p></div><button class="table-action" data-open-screen="WF-08">Xác minh</button></li>
              <li class="list-item"><div><strong>07 học sinh chưa nộp học phí</strong><p>03 lớp đang có khoản phải thu quá 7 ngày</p></div><button class="table-action" data-open-screen="WF-14">Đối soát</button></li>
              <li class="list-item"><div><strong>Phòng 201 vượt sức chứa</strong><p>Buổi 27/07 có 22 học sinh / sức chứa 20</p></div><button class="table-action" data-open-screen="WF-11">Đổi phòng</button></li>
            </ul>
          </section>
          <section class="card">
            <h2>Trạng thái lớp</h2>
            <div class="stack">
              <div><div class="metric-label"><span>Đang học</span><strong>28</strong></div><div class="progress"><span style="width:72%"></span></div></div>
              <div><div class="metric-label"><span>Chờ kết thúc</span><strong>4</strong></div><div class="progress"><span style="width:32%"></span></div></div>
              <div><div class="metric-label"><span>Đã đóng</span><strong>11</strong></div><div class="progress"><span style="width:48%"></span></div></div>
            </div>
          </section>
        </div>`
    },
    {
      id: "WF-04", role: "management", group: "Trung tâm", title: "Danh sách lớp",
      requirements: "FR-CLS-007 · FR-RPT-006", flow: "FL-05",
      render: () => `
        ${screenHead("Quản lý lớp", "Các lớp có buổi trong tháng 07/2026", "Mặc định theo buổi phát sinh trong tháng; có thể bỏ lọc tháng để xem toàn bộ.", actions("Tạo lớp", "Xuất Excel"))}
        ${filters(field("Giáo viên", '<select><option>Tất cả giáo viên</option><option>Nguyễn Thùy Lan</option><option>Trần Quốc Minh</option></select>'))}
        ${table(["Mã / Lớp", "Giáo viên chính", "Lịch định kỳ", "Tiến độ", "Kết thúc dự kiến", "Trạng thái", ""], [
          ["<strong>LOP-26031</strong><br>Toán tư duy 4A", "Nguyễn Thùy Lan", "T2 19:00 · T5 19:30", "14/24<br><div class='progress'><span style='width:58%'></span></div>", "28/09/2026", status("Đang học", "success"), '<button class="table-action" data-open-screen="WF-06">Chi tiết</button>'],
          ["<strong>LOP-26018</strong><br>IELTS 6.5", "Trần Quốc Minh", "T2 & T5 · 19:00", "23/24<br><div class='progress'><span style='width:96%'></span></div>", "27/07/2026", status("Chờ kết thúc", "warning"), '<button class="table-action" data-open-screen="WF-06">Chi tiết</button>'],
          ["<strong>LOP-26044</strong><br>Văn 8B", "Đỗ Thu Phương", "T4 & T6 · 19:00", "7/20<br><div class='progress'><span style='width:35%'></span></div>", "16/10/2026", status("Đang học", "success"), '<button class="table-action" data-open-screen="WF-06">Chi tiết</button>'],
          ["<strong>LOP-26007</strong><br>Toán 7A", "Nguyễn Đức Hùng", "T3 · 09:00", "18/18", "Đã đủ buổi", status("Chờ kết thúc", "warning"), '<button class="table-action" data-open-screen="WF-06">Kiểm tra</button>']
        ])}`
    },
    {
      id: "WF-05", role: "management", group: "Trung tâm", title: "Tạo / sửa lớp",
      requirements: "FR-CLS-001–006 · FR-FIN-001 · FR-PAY-001", flow: "FL-05",
      render: () => `
        ${screenHead("Wizard 3 bước", "Tạo lớp học mới", "Khóa dữ liệu nền, lịch lặp và bản xem trước trước khi công bố.", actions("Xem trước lịch", "Lưu nháp"))}
        <div class="grid grid-3">
          <aside class="card">
            <h2>Tiến trình</h2>
            <ol class="timeline">
              <li><strong>Thông tin lớp</strong><small>Đang chỉnh sửa</small></li>
              <li><strong>Lịch & phòng</strong><small>2 ca mỗi tuần</small></li>
              <li><strong>Xem trước & công bố</strong><small>Chưa xác nhận</small></li>
            </ol>
            ${notice("Mã được sinh tự động", "Mã lớp không sửa sau khi tạo.", "#")}
          </aside>
          <section class="card span-2">
            <h2>1. Thông tin lớp</h2>
            <div class="form-grid form-section">
              ${field("Tên lớp *", '<input value="Toán tư duy 4A">')}
              ${field("Giáo viên chính *", '<select><option>Nguyễn Thùy Lan</option></select>')}
              ${field("Ngày bắt đầu *", '<input type="date" value="2026-08-03">')}
              ${field("Tổng số buổi *", '<input type="number" value="24" min="1">')}
              ${field("Học phí cố định *", '<input value="4.800.000">', "Áp dụng giống nhau cho mọi học sinh")}
              ${field("Đơn giá dạy/giờ *", '<input value="200.000">', "Có lịch sử hiệu lực; không phải hệ số lương")}
              ${field("Sĩ số tối đa", '<input type="number" value="20">')}
              ${field("Hình thức mặc định", '<select><option>Tại lớp</option><option>Online</option></select>')}
            </div>
            <h2>2. Các ca lặp</h2>
            ${table(["Thứ", "Bắt đầu", "Kết thúc", "Phòng", "Hình thức", ""], [
              ["Thứ 2", "19:00", "21:00", "P.201 / 20 chỗ", "Tại lớp", '<button class="table-action" data-action="Sửa ca">Sửa</button>'],
              ["Thứ 5", "19:30", "21:00", "P.201 / 20 chỗ", "Tại lớp", '<button class="table-action" data-action="Sửa ca">Sửa</button>']
            ])}
            <br>${notice("Link buổi Online", "Không nhập khi tạo lớp hoặc ca. Giáo viên thực tế sẽ nhập link của từng buổi khi check-in.", "i")}
            <br>${notice("Bản xem trước", "24 buổi, bỏ qua 02/09 và 03/09; kết thúc dự kiến 29/10/2026. Không có trùng giáo viên/phòng.", "✓")}
          </section>
        </div>`
    },
    {
      id: "WF-06", role: "management", group: "Trung tâm", title: "Chi tiết lớp",
      requirements: "FR-CLS-008–012 · FR-ENR", flow: "FL-06",
      render: () => `
        ${screenHead("LOP-26031", "Toán tư duy 4A", "Trung tâm của tiến độ, lịch, roster, nội dung và việc cần hoàn thiện.", actions("Đóng lớp", "Chỉnh sửa"))}
        ${notice("2 việc cần xử lý", "01 học sinh chưa nộp học phí · 01 buổi thiếu record.", "!")}
        <br>
        ${tabs([
          { id: "overview", label: "Tổng quan", content: `
            ${metrics([["Tiến độ", "14 / 24", "58% lộ trình", "+2 buổi"], ["Chuyên cần", "93,2%", "Từ 286 lượt", "+1,8%"], ["BTVN đã chữa", "82%", "9 bài đã giao", "—"], ["Dự kiến kết thúc", "28/09", "Đã bỏ 1 ngày nghỉ", "—"]])}
            <br><div class="grid grid-2">
              <section class="card"><h2>Thông tin vận hành</h2>
                <div class="stat-pair"><div><small>Giáo viên chính</small><strong>Nguyễn Thùy Lan</strong></div><div><small>Đơn giá/giờ</small><strong>200.000đ</strong></div></div>
                <br>${notice("Bài gần nhất", "Buổi 14 · Phân số nâng cao · 23/07/2026", "14")}
              </section>
              <section class="card"><h2>Hồ sơ buổi</h2>
                <ul class="list"><li class="list-item"><div><strong>Buổi 12 thiếu record</strong><p>16/07 · GV Nguyễn Thùy Lan</p></div>${status("Thiếu", "warning")}</li>
                <li class="list-item"><div><strong>Buổi 13 đầy đủ</strong><p>20/07 · 18/19 tham gia</p></div>${status("Đủ", "success")}</li></ul>
              </section>
            </div>` },
          { id: "sessions", label: "Buổi học", content: table(["Buổi", "Ngày/giờ", "Bài đã dạy", "GV thực tế", "Hồ sơ"], [["14", "23/07 · 19:30", "Phân số nâng cao", "Nguyễn Thùy Lan", status("Đủ", "success")], ["13", "20/07 · 19:00", "Bài toán tỉ lệ", "Nguyễn Thùy Lan", status("Đủ", "success")], ["12", "16/07 · 19:30", "Ôn tập chương 2", "Nguyễn Thùy Lan", status("Thiếu record", "warning")]]) },
          { id: "roster", label: "Học sinh", content: `${notice("Quản lý danh sách lớp", "Chỉ Admin/Học vụ được thêm hoặc kết thúc enrollment. Thao tác thêm sẽ tạo khoản học phí chưa nộp.", "i")}<br><button class="button button-primary" data-action="Thêm học sinh có sẵn">+ Thêm học sinh</button><br><br>${table(["Mã", "Học sinh", "Phụ huynh", "Ngày vào", "Học phí", ""], [["HS-0142", "Nguyễn Minh Anh", "Chị Hương · 098•••212", "03/05/2026", status("Đã nộp", "success"), '<button class="table-action" data-open-screen="WF-10">Xem</button>'], ["HS-0194", "Lê Hoàng Nam", "Anh Dũng · 091•••887", "18/07/2026", status("Chưa nộp", "warning"), '<button class="table-action" data-action="Kết thúc enrollment">Quản lý</button>']])}` },
          { id: "materials", label: "Tài liệu", content: `<div class="file-grid"><div class="file-thumb">PDF<br><strong>Ôn tập chương 2</strong></div><div class="file-thumb">MP3<br><strong>Hướng dẫn bài 14</strong></div><button class="file-thumb" data-action="Tải tài liệu lên">+ Thêm tài liệu</button></div>` }
        ])}`
    },
    {
      id: "WF-07", role: "management", group: "Trung tâm", title: "Thời khóa biểu quản lý",
      requirements: "FR-SES-001 · FR-CLS-005–006", flow: "FL-05 · FL-07",
      render: () => `
        ${screenHead("Tuần 20–26/07/2026", "Thời khóa biểu toàn trung tâm", "Các lớp trùng ca được gom; click vào khối để xem giáo viên, lớp và phòng.", actions("In lịch tuần", "Xếp buổi bổ sung"))}
        <div class="toolbar">
          <button class="button button-secondary">← Tuần trước</button>
          ${field("Phòng", '<select><option>Tất cả phòng</option><option>P.201</option><option>P.102</option><option>Online</option></select>')}
          ${field("Giáo viên", '<select><option>Tất cả giáo viên</option><option>Trần Quốc Minh</option></select>')}
          <button class="button button-secondary">Tuần sau →</button>
        </div>
        ${calendar()}
        <br>${notice("1 cảnh báo học sinh trùng lịch", "Nguyễn Minh Anh có hai lớp lúc 19:00 Thứ 5. Giáo viên và phòng không có xung đột.", "!")}`
    },
    {
      id: "WF-08", role: "management", group: "Trung tâm", title: "Xử lý buổi học",
      requirements: "FR-SES-003–008 · FR-PAY-009", flow: "FL-07 · FL-08",
      render: () => `
        ${screenHead("BUOI-260723-19", "IELTS 6.5 · Buổi 23", "Buổi đã qua giờ nhưng không có check-in; quản lý phải xác nhận đã dạy hoặc hủy.", actions("Xác nhận đã dạy", "Thay giáo viên"))}
        ${notice("Đang chờ xác minh", "Lịch: 23/07/2026 · 19:00–21:00 · Online. Chưa phát sinh lương.", "!")}
        <br><div class="grid grid-3">
          <section class="card span-2">
            <h2>Dòng thời gian</h2>
            <ol class="timeline">
              <li><time>22/07 · 09:12</time><strong>Lịch được công bố</strong><small>GV dự kiến: Trần Quốc Minh</small></li>
              <li><time>23/07 · 18:30–21:00</time><strong>Không có check-in</strong><small>Không ghi nhận IP/thiết bị</small></li>
              <li><time>23/07 · 21:00</time><strong>Chuyển AwaitingVerification</strong><small>Scheduler · chưa tạo SalaryAccrual</small></li>
            </ol>
          </section>
          <section class="card">
            <h2>Tác động dự kiến</h2>
            <div class="stack">
              <div><small>Thời lượng</small><div class="amount">120 phút</div></div>
              <div><small>Đơn giá lớp</small><div class="amount">220.000đ/giờ</div></div>
              <div><small>Lương nếu xác nhận</small><div class="amount positive">${money.format(440000)}</div></div>
              <button class="button button-danger" data-action="Hủy buổi">Hủy / xếp bù</button>
            </div>
          </section>
        </div>
        <br>${table(["Học sinh", "Điểm danh", "BTVN", "Nhận xét"], [["Nguyễn Ngọc Mai", "Chưa có", "Đã nộp", "—"], ["Trần Gia Hân", "Chưa có", "Nộp trễ", "—"], ["Lê Anh Tú", "Chưa có", "Chưa nộp", "—"]], "Hồ sơ có thể bổ sung sau khi xác nhận")}`
    },
    {
      id: "WF-09", role: "management", group: "Trung tâm", title: "Danh bạ người dùng",
      requirements: "FR-PPL-001–004", flow: "FL-02 · FL-04",
      render: () => `
        ${screenHead("People directory", "Giáo viên & học sinh", "Một danh bạ theo tenant; tài khoản được tạo từng người, không import Excel.", actions("Tạo tài khoản", "Xuất Excel"))}
        ${filters(field("Loại hồ sơ", '<select><option>Tất cả</option><option>Giáo viên</option><option>Học sinh</option></select>'))}
        ${tabs([
          { id: "teachers", label: "Giáo viên (32)", content: table(["Mã", "Giáo viên", "Liên hệ", "Môn/kỹ năng", "Lớp active", "Trạng thái", ""], [["GV-0031", "Nguyễn Thùy Lan", "lan.nt@edu.vn<br>090•••211", "Toán tư duy", "3", status("Hoạt động", "success"), '<button class="table-action" data-open-screen="WF-10">Hồ sơ</button>'], ["GV-0018", "Trần Quốc Minh", "minh.tq@edu.vn<br>091•••554", "IELTS", "4", status("Hoạt động", "success"), '<button class="table-action" data-open-screen="WF-10">Hồ sơ</button>']]) },
          { id: "students", label: "Học sinh (1.284)", content: table(["Mã", "Học sinh", "Username", "Phụ huynh", "Lớp active", "Trạng thái", ""], [["HS-0142", "Nguyễn Minh Anh", "hs0142", "Nguyễn Thu Hương<br>098•••212", "2", status("Hoạt động", "success"), '<button class="table-action" data-open-screen="WF-10">Hồ sơ</button>'], ["HS-0194", "Lê Hoàng Nam", "hs0194", "Lê Đức Dũng<br>091•••887", "1", status("Hoạt động", "success"), '<button class="table-action" data-open-screen="WF-10">Hồ sơ</button>']]) }
        ])}`
    },
    {
      id: "WF-10", role: "management", group: "Trung tâm", title: "Hồ sơ người dùng",
      requirements: "FR-PPL-001–003 · FR-IAM-006", flow: "FL-03 · FL-04",
      render: () => `
        ${screenHead("GV-0031", "Nguyễn Thùy Lan", "Hồ sơ mở rộng của giáo viên; tệp HR chỉ hiển thị với Admin.", actions("Khóa tài khoản", "Chỉnh sửa"))}
        <div class="grid grid-3">
          <section class="card">
            <div class="profile-head"><div class="profile-photo">NL</div><div><h2>Nguyễn Thùy Lan</h2>${status("Đang hoạt động", "success")}<p class="meta-line">gv.nguyenlan</p></div></div>
            <br><div class="stack"><div><small>Điện thoại</small><strong>090 412 3211</strong></div><div><small>Email</small><strong>lan.nt@edu.vn</strong></div><div><small>Ngày bắt đầu</small><strong>15/08/2024</strong></div></div>
          </section>
          <section class="card span-2">
            ${tabs([
              { id: "professional", label: "Chuyên môn", content: `<div class="stat-pair"><div><small>Môn / kỹ năng</small><strong>Toán tư duy</strong></div><div><small>Lớp đang dạy</small><strong>03</strong></div></div><br>${table(["Lớp", "Vai trò", "Từ ngày", "Trạng thái"], [["Toán tư duy 4A", "GV chính", "03/05/2026", status("Đang học", "success")], ["Toán 7A", "Dạy thay 2 buổi", "12/06/2026", status("Lịch sử", "muted")]])}` },
              { id: "hr", label: "Hồ sơ HR · Admin", content: `<div class="file-grid"><div class="file-thumb">PDF<br><strong>Hợp đồng 2026</strong></div><div class="file-thumb">PDF<br><strong>Bằng Đại học</strong></div><div class="file-thumb">JPG<br><strong>CCCD</strong></div><button class="file-thumb" data-action="Tải tệp HR">+ Thêm tệp</button></div>` },
              { id: "security", label: "Tài khoản", content: `${notice("Lần đăng nhập gần nhất", "24/07/2026 · 07:42 · Chrome / Windows", "i")}<br><button class="button button-secondary" data-action="Đặt lại mật khẩu">Đặt lại mật khẩu tạm</button>` }
            ])}
          </section>
        </div>`
    },
    {
      id: "WF-11", role: "management", group: "Trung tâm", title: "Phòng & lịch nghỉ",
      requirements: "FR-CLS-003–005", flow: "FL-05",
      render: () => `
        ${screenHead("Cấu hình vận hành", "Phòng học & ngày nghỉ", "Phòng active tham gia kiểm tra xung đột; ngày nghỉ được bỏ qua khi sinh lịch.", actions("Thêm phòng", "Thêm ngày nghỉ"))}
        <div class="grid grid-2">
          <section class="card">
            <h2>Danh mục phòng</h2>
            ${table(["Phòng", "Sức chứa", "Lịch hôm nay", "Trạng thái"], [["P.201", "20", "5 buổi", status("Hoạt động", "success")], ["P.102", "16", "4 buổi", status("Hoạt động", "success")], ["P.301", "24", "0 buổi", status("Bảo trì", "warning")]])}
          </section>
          <section class="card">
            <h2>Lịch nghỉ năm 2026</h2>
            <ul class="list">
              <li class="list-item"><div><strong>Quốc khánh</strong><p>02/09–03/09/2026 · bỏ qua ca lặp</p></div><button class="table-action" data-action="Sửa ngày nghỉ">Sửa</button></li>
              <li class="list-item"><div><strong>Ngày Nhà giáo</strong><p>20/11/2026 · trung tâm nghỉ</p></div><button class="table-action" data-action="Sửa ngày nghỉ">Sửa</button></li>
              <li class="list-item"><div><strong>Tết Dương lịch</strong><p>01/01/2027 · trung tâm nghỉ</p></div><button class="table-action" data-action="Sửa ngày nghỉ">Sửa</button></li>
            </ul>
          </section>
        </div>`
    },
    {
      id: "WF-12", role: "management", group: "Trung tâm", title: "Nhận xét giáo viên",
      requirements: "FR-FBK-001–006", flow: "FL-13",
      render: () => `
        ${screenHead("Khảo sát định kỳ", "Đợt nhận xét giáo viên", "Quản lý thấy danh tính; giáo viên chỉ thấy nội dung ẩn danh khi đủ ít nhất 5 phản hồi.", actions("Tạo đợt", "Xuất kết quả"))}
        ${metrics([["Đợt đang mở", "04", "12 lớp được mời", "—"], ["Tỷ lệ phản hồi", "68%", "164 / 241 học sinh", "+9%"], ["Đủ ngưỡng ẩn danh", "09", "Từ 5 phản hồi trở lên", "—"], ["Sắp đóng", "02", "Trong 48 giờ", "!"]])}
        <br>${table(["Đợt", "Lớp / Giáo viên", "Thời gian", "Phản hồi", "GV được xem?", "Trạng thái", ""], [
          ["Phản hồi tháng 7", "IELTS 6.5<br>Trần Quốc Minh", "20–27/07", "4 / 18", "Chưa — dưới ngưỡng 5", status("Đang mở", "success"), '<button class="table-action" data-action="Xem danh tính phản hồi">Kết quả</button>'],
          ["Cuối khóa", "Toán 7A<br>Nguyễn Đức Hùng", "15–23/07", "16 / 19", "Có — ẩn danh", status("Đã đóng", "muted"), '<button class="table-action" data-action="Xem kết quả">Kết quả</button>']
        ])}`
    },
    {
      id: "WF-13", role: "management", group: "Tài chính", title: "Dashboard tài chính",
      requirements: "FR-RPT-002–005", flow: "FL-11 · FL-12",
      render: () => `
        ${screenHead("Kỳ 07/2026", "Dòng tiền & công nợ", "Phân biệt tiền thực thu/thực trả với học phí và lương phát sinh.", actions("In báo cáo", "Xuất Excel"))}
        ${metrics([["Thu học phí", "486,0 tr", "Theo ngày xác nhận", "+8,4%"], ["Hoàn tiền", "12,0 tr", "3 giao dịch", "−2"], ["Lương phát sinh", "214,8 tr", "1.074 giờ", "+4,1%"], ["Còn phải trả", "38,2 tr", "12 giáo viên", "!"]])}
        <br><div class="grid grid-3">
          <section class="card span-2">
            <h2>Xu hướng 6 tháng</h2>
            <div class="chart" aria-label="Biểu đồ cột thu ròng và lương">
              <div class="bar" style="height:54%"><span>T2</span></div><div class="bar is-outline" style="height:31%"><span></span></div>
              <div class="bar" style="height:66%"><span>T3</span></div><div class="bar is-outline" style="height:38%"><span></span></div>
              <div class="bar" style="height:71%"><span>T4</span></div><div class="bar is-outline" style="height:40%"><span></span></div>
              <div class="bar" style="height:79%"><span>T5</span></div><div class="bar is-outline" style="height:44%"><span></span></div>
              <div class="bar" style="height:82%"><span>T6</span></div><div class="bar is-outline" style="height:49%"><span></span></div>
              <div class="bar" style="height:91%"><span>T7</span></div><div class="bar is-outline" style="height:52%"><span></span></div>
            </div>
          </section>
          <section class="card">
            <h2>Đối soát</h2>
            <div class="stack">
              ${notice("03 refund tháng này", "Tổng 12.000.000đ đã trừ khỏi thu ròng.", "−")}
              ${notice("01 giáo viên trả thừa", "Do buổi 12/07 được sửa từ 120 còn 90 phút.", "!")}
              ${notice("07 khoản chưa nộp", "Tổng phải thu 33.600.000đ.", "+")}
            </div>
          </section>
        </div>`
    },
    {
      id: "WF-14", role: "management", group: "Tài chính", title: "Học phí & hoàn tiền",
      requirements: "FR-FIN-001–008", flow: "FL-11",
      render: () => `
        ${screenHead("Kế toán", "Học phí theo lớp", "Một khoản cố định cho mỗi enrollment; không trả góp, có hoàn một phần/toàn phần.", actions("Ghi nhận thu", "Xuất Excel"))}
        ${filters(field("Lớp", '<select><option>Tất cả lớp</option><option>Toán tư duy 4A</option><option>IELTS 6.5</option></select>'))}
        ${table(["Học sinh / Lớp", "Phải thu", "Ngày thu", "Phương thức", "Trạng thái", "Số đã hoàn", ""], [
          ["<strong>Nguyễn Minh Anh</strong><br>Toán tư duy 4A", '<span class="amount">4.800.000đ</span>', "05/05/2026", "Chuyển khoản<br>VCB-552198", status("Đã nộp", "success"), "0đ", '<button class="table-action" data-action="Tạo hoàn tiền">Hoàn tiền</button>'],
          ["<strong>Lê Hoàng Nam</strong><br>Toán tư duy 4A", '<span class="amount">4.800.000đ</span>', "—", "—", status("Chưa nộp", "warning"), "—", '<button class="table-action" data-action="Ghi nhận khoản thu">Ghi nhận thu</button>'],
          ["<strong>Trần Gia Hân</strong><br>IELTS 6.5", '<span class="amount">7.200.000đ</span>', "02/06/2026", "Tiền mặt", status("Hoàn một phần", "warning"), "1.200.000đ", '<button class="table-action" data-action="Xem giao dịch">Lịch sử</button>']
        ])}
        <br>${notice("Quy tắc xóa", "Giao dịch không bị xóa. Sai sót được void hoặc hoàn tiền có lý do và audit.", "i")}`
    },
    {
      id: "WF-15", role: "management", group: "Tài chính", title: "Lương giáo viên",
      requirements: "FR-PAY-001–009", flow: "FL-12",
      render: () => `
        ${screenHead("Kỳ 07/2026", "Lương phát sinh & đã trả", "Không khóa kỳ: chỉnh buổi cũ tính lại và hiển thị thiếu/thừa rõ ràng.", actions("Ghi thanh toán", "Xuất Excel"))}
        ${metrics([["Tổng giờ", "1.074,5", "Buổi Completed", "+42"], ["Lương phát sinh", "214,8 tr", "Theo đơn giá lớp", "+4,1%"], ["Đã trả", "176,6 tr", "14 đợt thanh toán", "—"], ["Số dư", "38,2 tr", "01 trường hợp trả thừa", "!"]])}
        <br>${table(["Giáo viên", "Giờ", "Tiền dạy", "Cộng/trừ", "Đã trả", "Còn lại", "Trạng thái", ""], [
          ["Nguyễn Thùy Lan", "82,5", '<span class="amount">16.500.000đ</span>', "+500.000đ", "12.000.000đ", '<span class="amount positive">5.000.000đ</span>', status("Còn phải trả", "warning"), '<button class="table-action" data-action="Mở chi tiết lương">Chi tiết</button>'],
          ["Trần Quốc Minh", "74", '<span class="amount">16.280.000đ</span>', "0đ", "16.280.000đ", "0đ", status("Đã cân bằng", "success"), '<button class="table-action" data-action="Mở chi tiết lương">Chi tiết</button>'],
          ["Nguyễn Đức Hùng", "68,5", '<span class="amount">13.700.000đ</span>', "−100.000đ", "13.800.000đ", '<span class="amount negative">−200.000đ</span>', status("Trả thừa", "danger"), '<button class="table-action" data-action="Xử lý trả thừa">Xử lý</button>']
        ])}`
    },
    {
      id: "WF-16", role: "management", group: "Hệ thống", title: "Nhật ký thay đổi",
      requirements: "FR-AUD-001–004", flow: "FL-14",
      render: () => `
        ${screenHead("Audit log", "Mọi thay đổi quan trọng đều có dấu vết", "Log chỉ đọc, phân quyền theo phạm vi nghiệp vụ và không có thao tác xóa.", actions("", "Xuất Excel"))}
        ${filters(field("Đối tượng", '<select><option>Tất cả đối tượng</option><option>Session</option><option>Tuition</option><option>Salary</option><option>Enrollment</option></select>'))}
        ${table(["Thời gian", "Người thực hiện", "Đối tượng", "Hành động", "Trước → Sau", "Lý do"], [
          ["24/07 · 09:14:22", "Nguyễn An · Admin", "Session<br>BUOI-260723-19", "Confirm taught", "AwaitingVerification → Completed", "Đã xác minh với giáo viên"],
          ["24/07 · 09:14:23", "System Scheduler", "SalaryAccrual<br>PAY-8821", "Create", "— → 440.000đ", "Từ buổi được xác nhận"],
          ["23/07 · 21:16:08", "Nguyễn Thùy Lan · GV", "LessonReport<br>BUOI-260723-14", "Update", "record: — → https://…", "Bổ sung hồ sơ buổi"],
          ["23/07 · 18:02:31", "Trần Hoa · Kế toán", "TuitionRefund<br>RF-184", "Create", "— → 1.200.000đ", "Học sinh chuyển lớp"]
        ])}`
    },
    {
      id: "WF-17", role: "teacher", group: "Giáo viên", title: "Dashboard giáo viên",
      requirements: "FR-SES-005 · FR-PAY-008", flow: "FL-08 · FL-12",
      render: () => `
        ${screenHead("GV Nguyễn Thùy Lan", "Hôm nay có 3 buổi dạy", "Tác vụ gần giờ được ưu tiên: check-in, hồ sơ còn thiếu và BTVN cần chữa.", '<div class="screen-actions"><button class="button button-secondary" data-open-screen="WF-19">Lớp của tôi</button><button class="button button-primary" data-open-screen="WF-18">Xem lịch tuần</button></div>')}
        ${metrics([["Buổi hôm nay", "03", "Buổi gần nhất lúc 14:00", "—"], ["Có thể check-in", "01", "Toán tư duy 4A", "NOW"], ["BTVN cần chữa", "17", "Từ 3 lớp", "!"], ["Lương tạm tính T7", "16,5 tr", "82,5 giờ", "+6h"]])}
        <br><div class="grid grid-2">
          <section class="card">
            <h2>Lịch hôm nay</h2>
            <ul class="list">
              <li class="list-item"><div><strong>07:00–09:00 · Toán 7A</strong><p>P.102 · đã hoàn tất</p></div><button class="table-action" data-open-screen="WF-27">Xem lại</button></li>
              <li class="list-item"><div><strong>14:00–16:00 · Toán tư duy 4A</strong><p>P.201 · mở check-in tới 16:00</p></div><button class="button button-primary" data-open-screen="WF-20">Check-in</button></li>
              <li class="list-item"><div><strong>19:00–21:00 · Toán tư duy 5B</strong><p>Online · chưa tới giờ</p></div>${status("Sắp tới", "muted")}</li>
            </ul>
          </section>
          <section class="card">
            <h2>Việc còn thiếu</h2>
            <div class="stack">
              <div class="notice"><span class="notice-icon" aria-hidden="true">!</span><div><strong>Buổi 12 thiếu record</strong><p>Toán tư duy 4A · 16/07</p></div><button class="table-action" data-open-screen="WF-27">Bổ sung</button></div>
              ${notice("08 bài nộp trễ", "Bài Phân số nâng cao", "8")}
              ${notice("Nhận xét lớp 5B", "Có thể bổ sung ở các buổi bạn trực tiếp dạy", "+")}
            </div>
          </section>
        </div>`
    },
    {
      id: "WF-18", role: "teacher", group: "Giáo viên", title: "Lịch dạy giáo viên",
      requirements: "FR-SES-002–004", flow: "FL-07",
      render: () => `
        ${screenHead("Tuần 20–26/07/2026", "Lịch dạy của tôi", "Xem không giới hạn tuần quá khứ/tương lai; dạy thay hiển thị cùng lịch chính.", actions("In lịch", ""))}
        <div class="toolbar"><button class="button button-secondary">← Tuần trước</button><button class="button button-secondary">Hôm nay</button><button class="button button-secondary">Tuần sau →</button></div>
        ${calendar()}
        <br>${notice("Dạy thay", "Buổi Toán 7A sáng Thứ 3 được quản lý đổi cho bạn lúc 18:02 ngày 20/07.", "↔")}`
    },
    {
      id: "WF-19", role: "teacher", group: "Giáo viên", title: "Danh sách lớp của giáo viên",
      requirements: "FR-CLS-013 · FR-ENR-004 · FR-SES-014", flow: "FL-02 · FL-06 · FL-09",
      render: () => `
        ${screenHead("Lớp của tôi", "Các lớp đang và đã dạy", "Tìm nhanh trong nhiều lớp, sau đó mở lớp để xem toàn bộ lịch sử buổi thuộc thời gian bạn được phân công. Danh sách học sinh do Admin/Học vụ quản lý.")}
        ${metrics([["Đang dạy", "03", "02 lớp giáo viên chính", "—"], ["Đã từng dạy", "08", "Có cả buổi dạy thay", "+2"], ["Buổi đã dạy", "126", "Trong 12 tháng", "+18"], ["Hồ sơ cần bổ sung", "02", "Record hoặc đánh giá", "!"]])}
        <br>
        <div class="toolbar">
          ${field("Tìm theo tên hoặc mã lớp", '<input type="search" value="" placeholder="Ví dụ: Toán tư duy 4A">')}
          ${field("Trạng thái lớp", '<select><option>Tất cả trạng thái</option><option>Đang hoạt động</option><option>Chờ kết thúc</option><option>Đã đóng</option><option>Đã hủy</option></select>')}
          ${field("Phạm vi", '<select><option>Đang và đã dạy</option><option>Đang dạy</option><option>Đã từng dạy</option></select>')}
          ${field("Vai trò", '<select><option>Tất cả vai trò</option><option>Giáo viên chính</option><option>Dạy thay</option></select>')}
          <button class="button button-secondary" data-action="Lọc lớp">Lọc</button>
        </div>
        <div class="class-list-grid">
          <article class="class-list-card">
            <div class="class-card-head"><div><span class="eyebrow">LOP-26031 · Giáo viên chính</span><h2>Toán tư duy 4A</h2></div>${status("Đang hoạt động", "success")}</div>
            <p>Thứ 2 · 19:00–21:00 & Thứ 5 · 19:30–21:00 · P.201</p>
            <div class="class-card-stats"><span><strong>14 / 24</strong> buổi</span><span><strong>19</strong> học sinh</span><span><strong>93,2%</strong> chuyên cần</span></div>
            <div class="class-card-foot"><small>Dạy gần nhất: 23/07 · Phân số nâng cao</small><button class="button button-primary" data-open-screen="WF-26">Xem các buổi</button></div>
          </article>
          <article class="class-list-card">
            <div class="class-card-head"><div><span class="eyebrow">LOP-26018 · Giáo viên chính</span><h2>Toán tư duy 5B</h2></div>${status("Đang hoạt động", "success")}</div>
            <p>Thứ 4 · 19:00–21:00 · Online</p>
            <div class="class-card-stats"><span><strong>09 / 20</strong> buổi</span><span><strong>16</strong> học sinh</span><span><strong>88,6%</strong> chuyên cần</span></div>
            <div class="class-card-foot"><small>Dạy gần nhất: 22/07 · Số thập phân</small><button class="button button-primary" data-open-screen="WF-26">Xem các buổi</button></div>
          </article>
          <article class="class-list-card">
            <div class="class-card-head"><div><span class="eyebrow">LOP-25902 · Dạy thay 3 buổi</span><h2>Toán 7A</h2></div>${status("Đã đóng", "muted")}</div>
            <p>Thời gian phân công: 12/03–28/03/2026 · P.102</p>
            <div class="class-card-stats"><span><strong>03</strong> buổi đã dạy</span><span><strong>21</strong> học sinh</span><span><strong>01</strong> điểm kiểm tra</span></div>
            <div class="class-card-foot"><small>Vẫn sửa được buổi bạn là GV thực tế</small><button class="button button-secondary" data-open-screen="WF-26">Xem lịch sử</button></div>
          </article>
          <article class="class-list-card">
            <div class="class-card-head"><div><span class="eyebrow">LOP-25841 · Giáo viên chính</span><h2>Toán nền tảng 6C</h2></div>${status("Đã hủy", "danger")}</div>
            <p>Thời gian phân công: 08/01–14/02/2026 · P.203</p>
            <div class="class-card-stats"><span><strong>08</strong> buổi đã dạy</span><span><strong>14</strong> học sinh</span><span><strong>02</strong> hồ sơ thiếu</span></div>
            <div class="class-card-foot"><small>Lịch sử được giữ, roster chỉ đọc</small><button class="button button-secondary" data-open-screen="WF-26">Xem lịch sử</button></div>
          </article>
        </div>
        <br>${notice("Phạm vi chỉnh sửa", "Bạn xem các buổi thuộc thời gian được phân công. Chỉ buổi bạn là giáo viên thực tế mới cho sửa dữ liệu sư phạm.", "i")}`
    },
    {
      id: "WF-20", role: "teacher", group: "Giáo viên", title: "Workspace buổi dạy",
      requirements: "FR-SES-005–013", flow: "FL-08 · FL-09",
      render: () => `
        ${screenHead("Buổi 15 · 24/07/2026", "Toán tư duy 4A · 14:00–16:00", "Một workspace cho check-in, điểm danh, nội dung thực dạy, nhận xét và record.", actions("Check-in buổi dạy", "Lưu nháp"))}
        ${notice("Cửa sổ check-in đang mở", "Mở từ 13:30 tới 16:00. Danh sách buổi do hệ thống lấy từ roster của lớp; giáo viên chỉ chọn trạng thái tham gia.", "✓")}
        <br>${notice("Áp dụng cho buổi Online", "Giáo viên thực tế nhập link của riêng buổi ngay khi check-in; link không được cấu hình trước ở lớp hoặc ca.", "i")}
        <br>${tabs([
          { id: "attendance", label: "Điểm danh · 4/5 tham gia", content: `<div class="card"><div class="check-row"><strong>Học sinh</strong><strong>Có mặt</strong><strong>Đi muộn</strong><strong>Về sớm</strong><strong>Vắng phép</strong><strong>Vắng KP</strong><strong>Ghi chú</strong></div>${attendanceRows()}</div>` },
          { id: "lesson", label: "Nội dung & record", content: `<section class="card"><div class="form-grid">${field("Tên bài đã dạy", '<input value="Phân số nâng cao">')}${field("URL record", '<input type="url" placeholder="https://…">', "Nhận mọi URL http/https hợp lệ")}</div><br>${field("Nội dung thực dạy", '<textarea rows="7">Ôn quy đồng mẫu số, bài toán vận dụng và chữa bài tập buổi 14.</textarea>')}</section>` },
          { id: "evaluations", label: "Nhận xét học sinh", content: table(["Học sinh", "Điểm danh", "Nhận xét tự do"], [["Nguyễn Minh Anh", "Có mặt", '<textarea rows="2" aria-label="Nhận xét Nguyễn Minh Anh">Nắm bài nhanh, cần trình bày rõ hơn.</textarea>'], ["Phạm Ngọc Linh", "Vắng có phép", '<textarea rows="2" aria-label="Nhận xét Phạm Ngọc Linh" placeholder="Có thể nhận xét cả học sinh vắng"></textarea>']]) },
          { id: "files", label: "Tài liệu", content: `<div class="file-grid"><div class="file-thumb">PDF<br><strong>Bài luyện tập 15</strong></div><div class="file-thumb">MP3<br><strong>Hướng dẫn</strong></div><button class="file-thumb" data-action="Đăng tài liệu">+ Tải tệp</button></div>` }
        ])}`
    },
    {
      id: "WF-21", role: "teacher", group: "Giáo viên", title: "BTVN & chữa bài",
      requirements: "FR-HW-001–008", flow: "FL-10",
      render: () => `
        ${screenHead("Toán tư duy 4A", "Bài tập về nhà", "Theo dõi lượt nộp, nộp trễ, yêu cầu làm lại và đã chữa—không dùng điểm.", actions("Giao BTVN", "Đóng bài"))}
        ${metrics([["Đã giao", "09", "Trong khóa hiện tại", "—"], ["Đã nộp", "16 / 19", "Bài gần nhất", "84%"], ["Nộp trễ", "04", "Vẫn nhận tới khi đóng", "!"], ["Cần chữa", "07", "Có 2 lượt nộp lại", "!"]])}
        <br>${table(["Học sinh", "Lượt gần nhất", "Thời điểm", "Ảnh", "Trạng thái", "Nhận xét / Thao tác"], [
          ["Nguyễn Minh Anh", "#2", "23/07 · 20:14", "5 ảnh", status("Nộp lại", "warning"), '<button class="table-action" data-action="Chữa bài">Mở bài</button>'],
          ["Trần Gia Hân", "#1", "24/07 · 08:33", "4 ảnh", status("Nộp trễ", "warning"), '<button class="table-action" data-action="Chữa bài">Mở bài</button>'],
          ["Lê Hoàng Nam", "#1", "22/07 · 19:02", "6 ảnh", status("Đã chữa", "success"), "Trình bày tốt, chú ý câu 4."],
          ["Phạm Ngọc Linh", "—", "—", "—", status("Chưa nộp", "danger"), '<button class="table-action" disabled>Chưa có bài</button>']
        ])}`
    },
    {
      id: "WF-22", role: "teacher", group: "Giáo viên", title: "Lương của giáo viên",
      requirements: "FR-PAY-002–009", flow: "FL-12",
      render: () => `
        ${screenHead("Kỳ 07/2026", "Giờ dạy & lương của tôi", "Mỗi dòng truy được buổi, thời lượng và đơn giá lớp; số liệu có thể đổi nếu buổi cũ được sửa.", actions("", "Xuất PDF"))}
        ${metrics([["Tổng giờ", "82,5", "38 buổi Completed", "+6h"], ["Tiền dạy", "16,5 tr", "Theo đơn giá lớp", "+1,2 tr"], ["Cộng / trừ", "+500k", "01 khoản thưởng", "—"], ["Còn phải trả", "5,0 tr", "Đã trả 12,0 tr", "!"]])}
        <br>${table(["Ngày", "Lớp / Buổi", "Thời lượng", "Đơn giá/giờ", "Tiền dạy", "Trạng thái"], [
          ["23/07", "Toán tư duy 4A · Buổi 14", "90 phút", "200.000đ", "300.000đ", status("Đã ghi nhận", "success")],
          ["21/07", "Toán 7A · Dạy thay", "120 phút", "200.000đ", "400.000đ", status("Đã ghi nhận", "success")],
          ["20/07", "Toán tư duy 4A · Buổi 13", "120 phút", "200.000đ", "400.000đ", status("Đã trả", "muted")]
        ])}
        <br>${notice("Công thức", "Số phút theo lịch ÷ 60 × đơn giá dạy/giờ có hiệu lực của lớp. Không có đơn giá riêng theo giáo viên.", "ƒ")}`
    },
    {
      id: "WF-23", role: "student", group: "Học sinh", title: "Dashboard học sinh",
      requirements: "FR-IAM-007 · FR-SES-002 · FR-NTF", flow: "FL-07 · FL-10",
      render: () => `
        ${screenHead("HS Nguyễn Minh Anh", "Lịch học & việc cần làm", "Giao diện mobile-first cho lịch, BTVN, tài liệu và thay đổi của lớp đang tham gia.", actions("Xem lịch tuần", ""))}
        ${metrics([["Buổi tuần này", "04", "Buổi gần nhất 19:00", "—"], ["BTVN cần nộp", "02", "01 bài sắp hạn", "!"], ["Bài đã chữa", "03", "Có nhận xét mới", "+1"], ["Lớp đang học", "02", "Quyền theo enrollment", "—"]])}
        <br><div class="grid grid-2">
          <section class="card">
            <h2>Buổi sắp tới</h2>
            <ul class="list">
              <li class="list-item"><div><strong>19:00 hôm nay · Toán tư duy 4A</strong><p>P.201 · GV Nguyễn Thùy Lan</p></div>${status("Tại lớp", "muted")}</li>
              <li class="list-item"><div><strong>19:00 Thứ 5 · IELTS 6.5</strong><p>Online · link trong chi tiết buổi</p></div>${status("Đã đổi GV", "warning")}</li>
            </ul>
          </section>
          <section class="card">
            <h2>Thông báo mới</h2>
            <div class="stack">
              ${notice("BTVN đã được chữa", "Bài Phân số nâng cao · xem nhận xét.", "✓")}
              ${notice("Lịch học thay đổi", "IELTS 6.5 chuyển sang GV Lê Minh Hà.", "↔")}
              ${notice("Có record mới", "Toán tư duy 4A · Buổi 14.", "▶")}
            </div>
          </section>
        </div>`
    },
    {
      id: "WF-24", role: "student", group: "Học sinh", title: "Lớp của học sinh",
      requirements: "FR-MAT-001–004 · FR-ENR-006", flow: "FL-06 · FL-10",
      render: () => `
        ${screenHead("Toán tư duy 4A", "Nội dung lớp học", "Chỉ truy cập khi enrollment active và lớp chưa đóng/hủy.", actions("", ""))}
        ${tabs([
          { id: "student-sessions", label: "Buổi học", content: table(["Buổi", "Ngày", "Nội dung", "Điểm danh", "Record"], [["14", "23/07", "Phân số nâng cao", status("Có mặt", "success"), '<button class="table-action" data-action="Mở record">Xem</button>'], ["13", "20/07", "Bài toán tỉ lệ", status("Đi muộn", "warning"), '<button class="table-action" data-action="Mở record">Xem</button>'], ["12", "16/07", "Ôn tập chương 2", status("Có mặt", "success"), "Chưa có"]]) },
          { id: "student-materials", label: "Tài liệu", content: `<div class="file-grid"><button class="file-thumb" data-action="Mở PDF">PDF<br><strong>Ôn tập chương 2</strong></button><button class="file-thumb" data-action="Nghe audio">MP3<br><strong>Hướng dẫn bài 14</strong></button></div>` },
          { id: "student-eval", label: "Nhận xét của GV", content: `<div class="stack">${notice("Buổi 14 · 23/07", "Nắm bài nhanh, cần trình bày rõ hơn ở phần giải.", "14")}${notice("Buổi 13 · 20/07", "Hoàn thành tốt bài vận dụng.", "13")}</div>` }
        ])}
        <br>${notice("Khi rời lớp", "Quyền tài liệu, record và nhận xét bị thu hồi ngay; trung tâm vẫn giữ lịch sử.", "i")}`
    },
    {
      id: "WF-25", role: "student", group: "Học sinh", title: "BTVN & phản hồi",
      requirements: "FR-HW-003–007 · FR-FBK-002–003", flow: "FL-10 · FL-13",
      render: () => `
        ${screenHead("Trung tâm học tập", "Bài tập & phản hồi giáo viên", "Tối ưu cho thao tác chụp/nộp ảnh trên điện thoại và góp ý định kỳ.", actions("", ""))}
        ${tabs([
          { id: "student-homework", label: "BTVN", content: `
            <div class="grid grid-2">
              <section class="card">
                <span class="eyebrow">Hạn 22:00 · 25/07</span>
                <h2>Phân số nâng cao</h2>
                <p>Làm bài 1–6 trang 28. Chụp rõ từng trang và nộp theo đúng thứ tự.</p>
                <div class="file-grid"><div class="file-thumb">Ảnh 1<br>IMG_8021.HEIC</div><div class="file-thumb">Ảnh 2<br>IMG_8022.HEIC</div><button class="file-thumb" data-action="Chọn ảnh">+ Thêm ảnh<br>2 / 10</button></div>
                <br><button class="button button-primary" data-action="Nộp bài">Nộp 2 ảnh</button>
              </section>
              <section class="card">
                <h2>Lịch sử lượt nộp</h2>
                <ol class="timeline"><li><time>23/07 · 20:14</time><strong>Lượt #2 · Nộp lại</strong><small>5 ảnh · đang chờ chữa</small></li><li><time>22/07 · 19:08</time><strong>Lượt #1 · Yêu cầu làm lại</strong><small>“Ảnh câu 4 bị mờ, em chụp lại nhé.”</small></li></ol>
              </section>
            </div>` },
          { id: "student-feedback", label: "Nhận xét giáo viên", content: `
            <section class="card">
              <span class="eyebrow">Đợt phản hồi tháng 7 · đóng 27/07</span>
              <h2>GV Trần Quốc Minh · IELTS 6.5</h2>
              ${notice("Ẩn danh với giáo viên", "Quản lý trung tâm vẫn thấy người gửi. Giáo viên chỉ xem khi có ít nhất 5 phản hồi.", "i")}
              <br>${field("Góp ý của bạn", '<textarea rows="8">Thầy giải thích dễ hiểu. Em mong phần chữa speaking có thêm ví dụ thực tế.</textarea>', "Bạn có thể sửa đến khi đợt đóng.")}
              <br><button class="button button-primary" data-action="Gửi phản hồi">Lưu phản hồi</button>
            </section>` }
        ])}`
    },
    {
      id: "WF-26", role: "teacher", group: "Giáo viên", title: "Lịch sử buổi theo lớp",
      requirements: "FR-CLS-014 · FR-SES-014 · FR-MAT-001", flow: "FL-06 · FL-07 · FL-09",
      render: () => `
        ${screenHead("Lớp của tôi / Toán tư duy 4A", "Tất cả buổi trong thời gian phân công", "Danh sách gồm cả buổi bạn trực tiếp dạy và buổi giáo viên khác dạy thay. Chỉ buổi bạn là giáo viên thực tế mới cho chỉnh sửa.", '<div class="screen-actions"><button class="button button-secondary" data-open-screen="WF-19">← Danh sách lớp</button><button class="button button-primary" data-action="Đăng tài liệu cho lớp">Đăng tài liệu</button></div>')}
        ${metrics([["Tiến độ lớp", "14 / 24", "58% lộ trình", "—"], ["Bạn trực tiếp dạy", "12", "Trong 14 buổi đã học", "86%"], ["Buổi dạy thay", "02", "Hiển thị chỉ đọc", "—"], ["Hồ sơ cần bổ sung", "01", "Buổi 12 thiếu record", "!"]])}
        <br>
        <div class="toolbar">
          ${field("Tìm buổi hoặc nội dung", '<input type="search" placeholder="Số buổi, tên bài…">')}
          ${field("Người dạy", '<select><option>Tất cả buổi trong nhiệm kỳ</option><option>Tôi trực tiếp dạy</option><option>Giáo viên dạy thay</option></select>')}
          ${field("Tình trạng hồ sơ", '<select><option>Tất cả hồ sơ</option><option>Đầy đủ</option><option>Thiếu record</option><option>Thiếu đánh giá</option></select>')}
          ${field("Thời gian", '<select><option>Toàn bộ lớp</option><option>Tháng 07/2026</option><option>Tháng 06/2026</option></select>')}
          <button class="button button-secondary" data-action="Lọc buổi">Lọc</button>
        </div>
        <p class="mobile-table-hint">Vuốt ngang bảng để xem điểm kiểm tra, tình trạng hồ sơ và thao tác mở buổi.</p>
        ${table(["Buổi", "Ngày & lịch học", "Nội dung đã dạy", "GV thực tế", "Tham gia", "BTVN", "Điểm KT", "Hồ sơ", ""], [
          ["14", "<strong>23/07/2026</strong><br>Thứ 5 · 19:30–21:00", "Phân số nâng cao", "<strong>Bạn</strong><br>Nguyễn Thùy Lan", "18 / 19", status("16 đã chữa", "success"), "04 kết quả", status("Đầy đủ", "success"), '<button class="table-action" data-open-screen="WF-27">Mở chi tiết</button>'],
          ["13", "<strong>20/07/2026</strong><br>Thứ 2 · 19:00–21:00", "Bài toán tỉ lệ", "<strong>Bạn</strong><br>Nguyễn Thùy Lan", "17 / 19", status("14 đã chữa", "success"), "—", status("Đầy đủ", "success"), '<button class="table-action" data-open-screen="WF-27">Mở chi tiết</button>'],
          ["12", "<strong>16/07/2026</strong><br>Thứ 5 · 19:30–21:00", "Ôn tập chương 2", "<strong>Bạn</strong><br>Nguyễn Thùy Lan", "18 / 19", status("15 đã chữa", "success"), "02 kết quả", status("Thiếu record", "warning"), '<button class="table-action" data-open-screen="WF-27">Bổ sung</button>'],
          ["11", "<strong>13/07/2026</strong><br>Thứ 2 · 19:00–21:00", "Bài toán chuyển động", "GV Lê Văn Hùng<br>Dạy thay", "19 / 19", status("Đã chữa", "success"), "—", status("Chỉ đọc", "muted"), '<button class="table-action" data-action="Mở buổi chỉ đọc">Xem</button>'],
          ["10", "<strong>09/07/2026</strong><br>Thứ 5 · 19:30–21:00", "Tỉ số phần trăm", "<strong>Bạn</strong><br>Nguyễn Thùy Lan", "16 / 18", status("13 đã chữa", "success"), "05 kết quả", status("Đầy đủ", "success"), '<button class="table-action" data-open-screen="WF-27">Mở chi tiết</button>']
        ], "Buổi mới nhất trước · roster dùng ảnh chụp tại thời điểm buổi")}
        <br>${notice("Lớp đã đóng vẫn truy cập được", "Bạn tiếp tục sửa dữ liệu sư phạm ở các buổi mình trực tiếp dạy. Thao tác không mở lại lớp và không thay đổi lương.", "i")}`
    },
    {
      id: "WF-27", role: "teacher", group: "Giáo viên", title: "Chi tiết buổi đã dạy",
      requirements: "FR-SES-013–017 · FR-HW-006 · FR-AUD-001", flow: "FL-09 · FL-10 · FL-14",
      render: () => `
        ${screenHead("Toán tư duy 4A / Buổi 14", "Chi tiết buổi đã dạy · 23/07/2026", "Giáo viên thực tế: Nguyễn Thùy Lan (bạn). Hồ sơ sư phạm được chỉnh sửa sau Completed và luôn lưu audit cũ–mới.", '<div class="screen-actions"><button class="button button-secondary" data-open-screen="WF-26">← Các buổi</button><button class="button button-primary" data-action="Lưu tất cả thay đổi">Lưu thay đổi</button></div>')}
        ${notice("Buổi đã Completed", "Sửa điểm danh, BTVN, nhận xét hoặc điểm kiểm tra không làm thay đổi trạng thái buổi, tiến độ lớp hay lương 300.000đ.", "✓")}
        <br>${metrics([["Lịch học", "19:30–21:00", "90 phút · P.201", "—"], ["Tham gia", "18 / 19", "01 vắng có phép", "94,7%"], ["BTVN đã chữa", "16 / 19", "02 yêu cầu làm lại", "84%"], ["Điểm kiểm tra", "04", "Kết quả trong buổi", "+4"]])}
        <br>${tabs([
          { id: "completed-students", label: "Học sinh & đánh giá", content: `
            <div class="session-review-layout">
              <section class="card">
                <div class="section-heading"><div><span class="eyebrow">Roster snapshot · 19 học sinh</span><h2>Danh sách học sinh trong buổi</h2></div>${status("Có quyền sửa", "success")}</div>
                <p class="mobile-table-hint">Vuốt ngang bảng để xem toàn bộ BTVN, nhận xét, điểm kiểm tra và nút chỉnh sửa.</p>
                ${table(["Học sinh", "Đi học", "Trạng thái BTVN", "Nhận xét BTVN", "Nhận xét buổi", "Điểm KT", ""], [
                  ["<strong>Nguyễn Minh Anh</strong><br>HS-0142", attendanceSelect("Nguyễn Minh Anh", "Có mặt"), status("Đã chữa", "success"), "Trình bày tốt, chú ý câu 4.", "Nắm bài nhanh, cần trình bày rõ hơn.", "<strong>8,5 / 10</strong><br>Kiểm tra 15 phút", '<button class="table-action" data-action="Chọn Nguyễn Minh Anh">Chỉnh sửa</button>'],
                  ["<strong>Trần Gia Hân</strong><br>HS-0178", attendanceSelect("Trần Gia Hân", "Đi muộn"), status("Nộp trễ", "warning"), "Cần bổ sung hình bài 5.", "Theo kịp bài sau 10 phút đầu.", "—", '<button class="table-action" data-action="Chọn Trần Gia Hân">Chỉnh sửa</button>'],
                  ["<strong>Lê Hoàng Nam</strong><br>HS-0194", attendanceSelect("Lê Hoàng Nam", "Có mặt"), status("Yêu cầu làm lại", "warning"), "Làm lại câu 2 và 6.", "Chủ động phát biểu.", "<strong>7 / 10</strong><br>Kiểm tra nhanh", '<button class="table-action" data-action="Chọn Lê Hoàng Nam">Chỉnh sửa</button>'],
                  ["<strong>Phạm Ngọc Linh</strong><br>HS-0211", attendanceSelect("Phạm Ngọc Linh", "Vắng có phép"), status("Chưa nộp", "danger"), "—", "Gia đình báo nghỉ trước buổi.", "—", '<button class="table-action" data-action="Chọn Phạm Ngọc Linh">Chỉnh sửa</button>'],
                  ["<strong>Đỗ Hải Yến</strong><br>HS-0220", attendanceSelect("Đỗ Hải Yến", "Có mặt"), status("Đã chữa", "success"), "Hoàn thành đầy đủ.", "Tiến bộ ở phần quy đồng.", "<strong>9 / 10</strong><br>Kiểm tra 15 phút", '<button class="table-action" data-action="Chọn Đỗ Hải Yến">Chỉnh sửa</button>']
                ])}
                <br>${notice("Không thay đổi roster", "Không thể thêm học sinh ở trang này. Nếu danh sách lớp sai, liên hệ Admin/Học vụ.", "i")}
              </section>
              <aside class="card student-editor">
                <span class="eyebrow">Đang chỉnh sửa</span>
                <h2>Nguyễn Minh Anh</h2>
                <div class="stack">
                  ${field("Trạng thái đi học", attendanceSelect("Nguyễn Minh Anh trong panel", "Có mặt"))}
                  ${field("Trạng thái BTVN", homeworkReviewSelect("Nguyễn Minh Anh", "Đã chữa"))}
                  ${field("Nhận xét BTVN", '<textarea rows="3">Trình bày tốt, chú ý câu 4.</textarea>', "Dùng chung dữ liệu với màn BTVN & chữa bài.")}
                  ${field("Nhận xét buổi học", '<textarea rows="4">Nắm bài nhanh, cần trình bày rõ hơn ở phần giải.</textarea>')}
                </div>
                <div class="score-editor">
                  <div class="section-heading"><div><span class="eyebrow">Điểm kiểm tra</span><h2>Kết quả đã có</h2></div><button class="table-action" data-action="Thêm điểm kiểm tra">+ Thêm</button></div>
                  <div class="score-result"><div><strong>Kiểm tra 15 phút</strong><small>23/07/2026 · “Nắm chắc quy đồng”</small></div><strong>8,5 / 10</strong></div>
                  <div class="form-grid">
                    ${field("Tên bài kiểm tra", '<input value="Kiểm tra nhanh cuối buổi">')}
                    ${field("Ngày kiểm tra", '<input type="date" value="2026-07-23">')}
                    ${field("Điểm đạt", '<input type="number" min="0" step="0.25" value="8.5">')}
                    ${field("Điểm tối đa", '<input type="number" min="0.25" step="0.25" value="10">')}
                  </div>
                  <br>${field("Nhận xét điểm kiểm tra", '<textarea rows="2" placeholder="Không bắt buộc">Nắm chắc quy đồng.</textarea>')}
                  <br><button class="button button-secondary" data-action="Lưu điểm kiểm tra">Lưu điểm kiểm tra</button>
                </div>
                <br><button class="button button-primary button-block" data-action="Lưu đánh giá Nguyễn Minh Anh">Lưu học sinh này</button>
                <br><small class="meta-line">Sửa gần nhất: 24/07/2026 · 09:18 · bởi bạn</small>
              </aside>
            </div>` },
          { id: "completed-lesson", label: "Nội dung & record", content: `
            <section class="card">
              <div class="form-grid">
                ${field("Tên bài đã dạy", '<input value="Phân số nâng cao">')}
                ${field("URL record", '<input type="url" value="https://youtube.com/watch?v=example">', "Nhận mọi URL http/https hợp lệ.")}
              </div>
              <br>${field("Nội dung thực dạy", '<textarea rows="8">Ôn quy đồng mẫu số, bài toán vận dụng và chữa bài tập buổi 13. Kiểm tra nhanh 15 phút cuối buổi.</textarea>')}
              <br><button class="button button-primary" data-action="Lưu nội dung và record">Lưu nội dung & record</button>
            </section>` },
          { id: "completed-audit", label: "Lịch sử chỉnh sửa", content: table(["Thời gian", "Người sửa", "Dữ liệu", "Trước → Sau"], [
            ["24/07 · 09:18", "Nguyễn Thùy Lan · GV thực tế", "Nhận xét buổi · Nguyễn Minh Anh", "“Nắm bài” → “Nắm bài nhanh, cần trình bày rõ hơn”"],
            ["24/07 · 09:16", "Nguyễn Thùy Lan · GV thực tế", "Điểm kiểm tra · Nguyễn Minh Anh", "— → 8,5 / 10"],
            ["23/07 · 21:16", "Nguyễn Thùy Lan · GV thực tế", "Record URL", "— → https://youtube.com/…"],
            ["23/07 · 21:05", "System", "Trạng thái buổi", "CheckedIn → Completed"]
          ], "Audit chỉ đọc; buổi và lương không đổi khi sửa dữ liệu sư phạm") }
        ])}`
    }
  ];

  const screenMap = new Map(screenList.map((screen) => [screen.id, screen]));
  const navGroups = [
    ["Dùng chung", ["WF-01"]],
    ["Nền tảng", ["WF-02"]],
    ["Trung tâm", ["WF-03", "WF-04", "WF-05", "WF-06", "WF-07", "WF-08", "WF-09", "WF-10", "WF-11", "WF-12"]],
    ["Tài chính", ["WF-13", "WF-14", "WF-15"]],
    ["Hệ thống", ["WF-16"]],
    ["Giáo viên", ["WF-17", "WF-18", "WF-19", "WF-26", "WF-27", "WF-20", "WF-21", "WF-22"]],
    ["Học sinh", ["WF-23", "WF-24", "WF-25"]]
  ];

  const dom = {
    sideNav: document.getElementById("sideNav"),
    roleSelect: document.getElementById("roleSelect"),
    screenCode: document.getElementById("screenCode"),
    screenTitle: document.getElementById("screenTitle"),
    screenContent: document.getElementById("screenContent"),
    requirements: document.getElementById("traceRequirements"),
    flow: document.getElementById("traceFlow"),
    stateStage: document.getElementById("stateStage"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modal: document.querySelector(".modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalMessage: document.getElementById("modalMessage"),
    toast: document.getElementById("toast"),
    sidebar: document.getElementById("sidebar"),
    sidebarScrim: document.getElementById("sidebarScrim"),
    menuButton: document.getElementById("menuButton")
  };

  let currentScreen = "WF-03";
  let lastFocus = null;
  let toastTimer = null;

  function visibleForRole(screen, role) {
    if (role === "all") return true;
    if (screen.id === "WF-01") return true;
    return screen.role === role || (role === "management" && screen.role === "management");
  }

  function renderNav() {
    const role = dom.roleSelect.value;
    dom.sideNav.innerHTML = navGroups.map(([group, ids]) => {
      const visible = ids.map((id) => screenMap.get(id)).filter((screen) => visibleForRole(screen, role));
      if (!visible.length) return "";
      return `<section class="nav-group">
        <h2 class="nav-group-title">${group}</h2>
        ${visible.map((screen) => `<button class="nav-link ${screen.id === currentScreen ? "is-active" : ""}" data-open-screen="${screen.id}">
          <span class="nav-code">${screen.id.replace("WF-", "")}</span>
          <span class="nav-label">${screen.title}</span>
        </button>`).join("")}
      </section>`;
    }).join("");
  }

  function renderScreen(id, pushHash = true) {
    const screen = screenMap.get(id) || screenMap.get("WF-03");
    currentScreen = screen.id;
    dom.screenCode.textContent = screen.id;
    dom.screenTitle.textContent = screen.title;
    dom.requirements.textContent = screen.requirements;
    dom.flow.textContent = screen.flow;
    dom.screenContent.innerHTML = screen.render();
    document.title = `${screen.id} · ${screen.title} — EDU OPS`;
    setDemoState("normal");
    renderNav();
    bindScreenInteractions();
    if (pushHash && location.hash !== `#${screen.id}`) history.pushState(null, "", `#${screen.id}`);
    if (pushHash) dom.screenContent.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
    closeSidebar();
  }

  function bindScreenInteractions() {
    dom.screenContent.querySelectorAll("[data-tab]").forEach((tabButton) => {
      tabButton.addEventListener("click", () => {
        const container = tabButton.closest(".card") || dom.screenContent;
        container.querySelectorAll("[data-tab]").forEach((button) => button.setAttribute("aria-selected", String(button === tabButton)));
        container.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== tabButton.dataset.tab; });
      });
    });
  }

  function showToast(title = "Đã lưu thay đổi", text = "Nhật ký thao tác đã được cập nhật.") {
    clearTimeout(toastTimer);
    dom.toast.querySelector("strong").textContent = title;
    dom.toast.querySelector("span").textContent = text;
    dom.toast.hidden = false;
    toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 3200);
  }

  function openModal(title, message) {
    lastFocus = document.activeElement;
    dom.modalTitle.textContent = title;
    dom.modalMessage.textContent = message;
    dom.modalBackdrop.hidden = false;
    dom.modal.focus();
  }

  function closeModal() {
    dom.modalBackdrop.hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  function loadingState() {
    return `<div class="state-placeholder"><div class="state-inner" aria-label="Đang tải">
      <div class="state-glyph skeleton"></div>
      <div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line"></div>
      <p>Đang tải dữ liệu có quyền truy cập…</p>
    </div></div>`;
  }

  function emptyState() {
    return `<div class="state-placeholder"><div class="state-inner">
      <div class="state-glyph">∅</div><h2>Chưa có dữ liệu</h2>
      <p>Bộ lọc hiện tại không có kết quả. Thử đổi khoảng thời gian hoặc tạo bản ghi đầu tiên.</p>
      <button class="button button-primary" data-action="Tạo bản ghi">Tạo mới</button>
    </div></div>`;
  }

  function errorState() {
    return `<div class="state-placeholder"><div class="state-inner">
      <div class="state-glyph">!</div><h2>Không tải được dữ liệu</h2>
      <p>Kết nối tạm thời gián đoạn. Dữ liệu bạn đã nhập vẫn được giữ trên màn hình.</p>
      <button class="button button-primary" data-action="Thử lại">Thử lại</button>
    </div></div>`;
  }

  function setDemoState(state) {
    document.querySelectorAll("[data-demo-state]").forEach((button) => button.classList.toggle("is-active", button.dataset.demoState === state));
    if (state === "normal") {
      const screen = screenMap.get(currentScreen);
      if (dom.screenContent.dataset.replaced === "true") {
        dom.screenContent.innerHTML = screen.render();
        dom.screenContent.dataset.replaced = "false";
        bindScreenInteractions();
      }
      return;
    }
    if (state === "confirm") {
      setDemoState("normal");
      openModal("Xác nhận thay đổi quan trọng", "Thao tác mẫu yêu cầu lý do và sẽ tạo audit có giá trị cũ–mới.");
      return;
    }
    dom.screenContent.innerHTML = state === "loading" ? loadingState() : state === "empty" ? emptyState() : errorState();
    dom.screenContent.dataset.replaced = "true";
  }

  function openSidebar() {
    dom.sidebar.classList.add("is-open");
    dom.sidebarScrim.classList.add("is-visible");
    dom.menuButton.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    dom.sidebar.classList.remove("is-open");
    dom.sidebarScrim.classList.remove("is-visible");
    dom.menuButton.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", (event) => {
    const screenButton = event.target.closest("[data-open-screen]");
    if (screenButton) {
      renderScreen(screenButton.dataset.openScreen);
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      const action = actionButton.dataset.action;
      const critical = /khóa|hủy|đóng|hoàn|xác nhận|bỏ|thay/i.test(action);
      if (critical) openModal(action, "Hãy kiểm tra tác động, nhập lý do và xác nhận. Prototype không thay đổi dữ liệu thật.");
      else showToast(action, "Tương tác mẫu đã được ghi nhận trong prototype.");
    }
  });

  document.querySelectorAll("[data-demo-state]").forEach((button) => {
    button.addEventListener("click", () => setDemoState(button.dataset.demoState));
  });

  dom.roleSelect.addEventListener("change", () => {
    const role = dom.roleSelect.value;
    const first = screenList.find((screen) => visibleForRole(screen, role) && screen.id !== "WF-01") || screenMap.get("WF-01");
    renderScreen(first.id);
  });

  dom.menuButton.addEventListener("click", () => dom.sidebar.classList.contains("is-open") ? closeSidebar() : openSidebar());
  dom.sidebarScrim.addEventListener("click", closeSidebar);

  document.querySelector("[data-modal-close]").addEventListener("click", closeModal);
  document.querySelector("[data-modal-confirm]").addEventListener("click", () => {
    closeModal();
    showToast("Đã xác nhận", "Audit log sẽ lưu người, thời gian, lý do và giá trị cũ–mới.");
  });
  dom.modalBackdrop.addEventListener("click", (event) => { if (event.target === dom.modalBackdrop) closeModal(); });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!dom.modalBackdrop.hidden) closeModal();
      else closeSidebar();
    }
  });

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1).toUpperCase();
    if (screenMap.has(id) && id !== currentScreen) renderScreen(id, false);
  });

  const initial = location.hash.slice(1).toUpperCase();
  renderScreen(screenMap.has(initial) ? initial : "WF-03", false);
})();
