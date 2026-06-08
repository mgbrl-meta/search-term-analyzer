import type { ReactNode } from "react";

export type GoogleOsColumn<T> = {
  key: string;
  label: string;
  right?: boolean;
  render?: (row: T) => ReactNode;
};

export function GoogleOsTable<T extends Record<string, unknown>>({
  rows,
  columns,
  empty = "No data available.",
}: {
  rows: T[];
  columns: GoogleOsColumn<T>[];
  empty?: string;
}) {
  if (!rows.length) {
    return (
      <div className="gos-empty">
        <strong>{empty}</strong>
      </div>
    );
  }

  return (
    <div className="gos-table-wrap">
      <table className="gos-table">
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
                <td
                  key={column.key}
                  className={column.right ? "right" : ""}
                  data-label={column.label}
                >
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
