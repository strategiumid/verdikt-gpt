import React, { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Dashboard } from "./pages/Dashboard";
import { Users } from "./pages/Users";

type PageKey = "dashboard" | "users";

export const App: React.FC = () => {
  const [page, setPage] = useState<PageKey>("dashboard");

  const renderPage = () => {
    switch (page) {
      case "users":
        return <Users />;
      case "dashboard":
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-root">
      <Sidebar current={page} onChange={setPage} />
      <div className="app-main">
        <Topbar />
        <main className="app-content">{renderPage()}</main>
      </div>
    </div>
  );
};

