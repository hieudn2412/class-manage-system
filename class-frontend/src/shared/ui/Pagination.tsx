import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

export const Pagination = ({
  page,
  totalPages,
  totalItems,
  itemLabel = "lớp",
  onPageChange,
}: PaginationProps) => (
  <nav className="pagination" aria-label="Phân trang">
    <span>
      Trang <strong>{page}</strong> / {totalPages} · {totalItems} {itemLabel}
    </span>
    <div className="pagination-actions">
      <Button
        variant="secondary"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Trang trước"
      >
        <ChevronLeft size={17} aria-hidden="true" />
        Trước
      </Button>
      <Button
        variant="secondary"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Trang sau"
      >
        Sau
        <ChevronRight size={17} aria-hidden="true" />
      </Button>
    </div>
  </nav>
);
