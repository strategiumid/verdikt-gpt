import React from "react";

export const Topbar: React.FC = () => {
  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">Админ-панель</h1>
        <p className="topbar-subtitle">Управление системой и пользователями</p>
      </div>
      <div className="topbar-right">
        <input
          type="search"
          placeholder="Поиск..."
          className="topbar-search"
        />
        <div className="topbar-user">
          <span className="topbar-avatar">M</span>
          <span className="topbar-username">admin</span>
        </div>
      </div>
    </header>
  );
};

