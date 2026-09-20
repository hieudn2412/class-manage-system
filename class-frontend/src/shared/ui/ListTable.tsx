import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface ListTableColumn<Item> {
  id: string;
  header: ReactNode;
  cell: (item: Item) => ReactNode;
  className?: string;
  headerClassName?: string;
  ariaSort?: "ascending" | "descending" | "none";
}

interface ListTableProps<Item> {
  caption: string;
  items: Item[];
  columns: ListTableColumn<Item>[];
  getRowKey: (item: Item) => string;
  getRowClassName?: (item: Item) => string | undefined;
  className?: string;
  wrapperClassName?: string;
}

export const ListTable = <Item,>({
  caption,
  items,
  columns,
  getRowKey,
  getRowClassName,
  className,
  wrapperClassName,
}: ListTableProps<Item>) => (
  <div className={cn("list-table-wrap", wrapperClassName)}>
    <table className={cn("list-table", className)}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.id}
              scope="col"
              className={cn(column.className, column.headerClassName)}
              aria-sort={column.ariaSort}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={getRowKey(item)} className={getRowClassName?.(item)}>
            {columns.map((column) => (
              <td key={column.id} className={column.className}>
                {column.cell(item)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
