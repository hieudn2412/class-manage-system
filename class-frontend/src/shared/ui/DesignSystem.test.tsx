import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { MetricCard } from "./MetricCard";
import { PageHeader } from "./PageHeader";
import { TableShell } from "./TableShell";

describe("Education Design System primitives", () => {
  it("exposes the accent action and consistent size variants", () => {
    render(
      <Button variant="accent" size="large">
        Xác nhận
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Xác nhận" })).toHaveClass(
      "button-accent",
      "button-large",
    );
  });

  it("renders semantic surfaces without changing content semantics", () => {
    render(
      <>
        <Badge tone="accent">Thành tích</Badge>
        <Card tone="success">Đã hoàn tất</Card>
        <MetricCard label="Lớp đang học" value="4" detail="Trong tháng này" />
        <TableShell>
          <table aria-label="Danh sách mẫu" />
        </TableShell>
      </>,
    );

    expect(screen.getByText("Thành tích")).toHaveClass("badge-accent");
    expect(screen.getByText("Đã hoàn tất")).toHaveClass("card-success");
    expect(screen.getByText("Lớp đang học")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Danh sách mẫu" })).toBeInTheDocument();
  });

  it("supports compact page headers and optional eyebrows", () => {
    render(<PageHeader compact title="Lịch học" subtitle="Tuần hiện tại" />);

    expect(screen.getByRole("heading", { name: "Lịch học" })).toBeInTheDocument();
    expect(screen.getByText("Tuần hiện tại").closest("header")).toHaveClass("page-header-compact");
  });
});
