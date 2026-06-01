import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  right?: boolean;
  render?: (row: T) => ReactNode;
};

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  empty = "No data found.",
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  empty?: string;
}) {
  if (!rows.length) {
    return (
      <div className="st-empty">
        <strong>{empty}</strong>
      </div>
    );
  }

  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.right ? "right" : ""}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column.key} className={column.right ? "right" : ""}>
                  {column.render ? column.render(row) : String(row[column.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
