import React from "react";

export interface TableColumn<T> {
  key: keyof T;
  label: string;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data
}: DataTableProps<T>) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={String(col.key)}>{String(row[col.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

