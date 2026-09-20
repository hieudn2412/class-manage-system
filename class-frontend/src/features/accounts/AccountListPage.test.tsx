import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { managementRepository } from "../../services/repositories/managementRepository";
import type { Account } from "../../shared/types/domain";
import { renderWithProviders } from "../../test/render";
import { AccountListPage } from "./AccountListPage";

const account: Account = {
  id: "account-1",
  profileType: "TEACHER",
  code: "GV-0001",
  username: "co.lan",
  displayName: "Cô Lan",
  email: "lan@example.com",
  roles: ["TEACHER"],
  status: "ACTIVE",
  passwordState: "READY",
  parentName: null,
  parentPhone: null,
  lastLoginAt: null,
  createdAt: "2026-09-01T00:00:00Z",
  version: 0,
};

afterEach(() => vi.restoreAllMocks());

describe("danh sách tài khoản", () => {
  it("hiển thị list gọn và mở popup xem chi tiết người dùng", async () => {
    const list = vi.spyOn(managementRepository, "accounts").mockResolvedValue({
      items: [account],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/t/:tenantSlug/app/accounts" element={<AccountListPage />} />
      </Routes>,
      ["/t/anh-duong/app/accounts"],
    );

    expect(await screen.findByText("Cô Lan")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: /Tên/ })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: /Chức vụ/ })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: /Ngày tạo/ })).toBeVisible();
    const table = screen.getByRole("table", { name: "Danh sách người dùng của trung tâm" });
    expect(within(table).getByText("Giáo viên")).toBeVisible();
    expect(within(table).getAllByText("01/09/2026")[0]).toBeVisible();
    expect(screen.queryByText("GV-0001")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem chi tiết Cô Lan" })).toBeVisible();
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.stringContaining("sort=displayName%2Casc")),
    );

    await user.click(screen.getByRole("button", { name: "Xem chi tiết Cô Lan" }));
    const dialog = await screen.findByRole("dialog", { name: "Thông tin người dùng" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("lan@example.com")).toBeVisible();
    expect(within(dialog).getByText("GV-0001 · Giáo viên")).toBeVisible();
    expect(screen.getByRole("link", { name: "Chỉnh sửa" })).toHaveAttribute(
      "href",
      "/t/anh-duong/app/accounts/account-1",
    );

    await user.click(screen.getByRole("button", { name: "Đóng" }));

    await user.click(screen.getByRole("button", { name: "Tên: đang tăng dần" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.stringContaining("sort=displayName%2Cdesc")),
    );

    await user.click(screen.getByRole("button", { name: "Chức vụ: nhấn để sắp xếp" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.stringContaining("sort=profileType%2Casc")),
    );

    await user.click(screen.getByRole("button", { name: "Ngày tạo: nhấn để sắp xếp" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.stringContaining("sort=createdAt%2Casc")),
    );
  });
});
