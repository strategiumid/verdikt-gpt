import React from "react";
import { DataTable, TableColumn } from "../components/DataTable";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

const userColumns: TableColumn<UserRow>[] = [
  { key: "name", label: "Имя" },
  { key: "email", label: "Email" },
  { key: "role", label: "Роль" },
  { key: "status", label: "Статус" }
];

const userData: UserRow[] = [
  { id: 1, name: "Иван Петров", email: "ivan@example.com", role: "Администратор", status: "Активен" },
  { id: 2, name: "Анна Смирнова", email: "anna@example.com", role: "Модератор", status: "Активен" },
  { id: 3, name: "Павел Сидоров", email: "pavel@example.com", role: "Пользователь", status: "Заблокирован" },
  { id: 4, name: "System", email: "system@example.com", role: "Сервис", status: "Скрыт" }
];

export const Users: React.FC = () => {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Пользователи</h2>
          <p className="page-subtitle">Список пользователей системы и их роли</p>
        </div>
        <button className="btn-primary">+ Новый пользователь</button>
      </div>

      <section className="section">
        <DataTable columns={userColumns} data={userData} />
      </section>
    </div>
  );
};

