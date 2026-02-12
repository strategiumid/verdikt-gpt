import React from "react";

type PageKey = "dashboard" | "users";

interface SidebarProps {
  current: PageKey;
  onChange: (page: PageKey) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ current, onChange }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Verdikt Admin</div>
      <nav className="sidebar-nav">
        <button
          className={`sidebar-item ${current === "dashboard" ? "active" : ""}`}
          onClick={() => onChange("dashboard")}
        >
          <span className="sidebar-item-badge" />
          Дашборд
        </button>
        <button
          className={`sidebar-item ${current === "users" ? "active" : ""}`}
          onClick={() => onChange("users")}
        >
          <span className="sidebar-item-badge" />
          Пользователи
        </button>
      </nav>
    </aside>
  );
};

