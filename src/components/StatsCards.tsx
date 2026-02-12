import React from "react";

interface StatCard {
  id: string;
  label: string;
  value: string;
  trend?: string;
}

const mockStats: StatCard[] = [
  { id: "users", label: "Пользователи", value: "1 248", trend: "+8% за неделю" },
  { id: "sessions", label: "Сессии", value: "4 932", trend: "+3% за сутки" },
  { id: "errors", label: "Ошибки", value: "27", trend: "-12% за неделю" },
  { id: "revenue", label: "Выручка", value: "₽ 328k", trend: "+15% за месяц" }
];

export const StatsCards: React.FC = () => {
  return (
    <section className="card-grid">
      {mockStats.map((card) => (
        <article key={card.id} className="card">
          <h3 className="card-title">{card.label}</h3>
          <div className="card-value">{card.value}</div>
          {card.trend && <div className="card-trend">{card.trend}</div>}
        </article>
      ))}
    </section>
  );
};

