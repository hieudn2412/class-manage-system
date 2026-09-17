import { screen, waitFor } from "@testing-library/react";
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
  it("đổi cột và chiều sắp xếp bằng nút cạnh tên cột", async () => {
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
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.stringContaining("sort=displayName%2Casc")),
    );

    await user.click(screen.getByRole("button", { name: "Tài khoản: đang tăng dần" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.stringContaining("sort=displayName%2Cdesc")),
    );

    await user.click(screen.getByRole("button", { name: "Hồ sơ: nhấn để sắp xếp" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.stringContaining("sort=profileType%2Casc")),
    );

    expect(screen.getByRole("button", { name: "Vai trò: nhấn để sắp xếp" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Trạng thái: nhấn để sắp xếp" })).toBeVisible();
  });
});
