import React from "react";
import { StatsCards } from "../components/StatsCards";
import { DataTable, TableColumn } from "../components/DataTable";

interface ActivityRow {
  id: number;
  time: string;
  user: string;
  action: string;
  status: string;
}

const activityColumns: TableColumn<ActivityRow>[] = [
  { key: "time", label: "Время" },
  { key: "user", label: "Пользователь" },
  { key: "action", label: "Действие" },
  { key: "status", label: "Статус" }
];

const activityData: ActivityRow[] = [
  {
    id: 1,
    time: "12:03",
    user: "ivan.petrov",
    action: "Создание записи",
    status: "Успешно"
  },
  {
    id: 2,
    time: "11:47",
    user: "system",
    action: "Плановая очистка",
    status: "Успешно"
  },
  {
    id: 3,
    time: "11:15",
    user: "admin",
    action: "Изменение прав",
    status: "Успешно"
  },
  {
    id: 4,
    time: "10:59",
    user: "guest",
    action: "Неуспешный логин",
    status: "Ошибка"
  }
];

export const Dashboard: React.FC = () => {
  return (
    <div className="page">
      <h2 className="page-title">Общая статистика</h2>
      <StatsCards />

      <section className="section">
        <div className="section-header">
          <h3 className="section-title">Последние действия</h3>
          <span className="section-caption">обновлено 5 минут назад</span>
        </div>
        <DataTable columns={activityColumns} data={activityData} />
      </section>
    </div>
  );
};

