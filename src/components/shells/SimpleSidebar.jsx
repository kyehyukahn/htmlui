import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCameraRetro, faListCheck } from "@fortawesome/free-solid-svg-icons";
import { AuthContext } from "../../contexts/AuthContext";

export function SimpleSidebar() {
  const auth = useContext(AuthContext);
  const badge = auth.runningTaskCount > 0 ? ` (${auth.runningTaskCount})` : "";

  return (
    <aside className="vk-sidebar">
      <div className="vk-sidebar-brand">
        <img src="/kopia-flat.svg" alt="logo" />
        <span className="vk-sidebar-name">Kopia</span>
      </div>
      <nav className="vk-sidebar-nav">
        <NavLink to="/snapshots" className={({ isActive }) => "vk-sidebar-link" + (isActive ? " active" : "")}>
          <FontAwesomeIcon icon={faCameraRetro} /> Snapshots
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) => "vk-sidebar-link" + (isActive ? " active" : "")}>
          <FontAwesomeIcon icon={faListCheck} /> Tasks{badge}
        </NavLink>
      </nav>
      <div className="vk-sidebar-footer">
        v{import.meta.env.VITE_FULL_VERSION_INFO || "dev"}
      </div>
    </aside>
  );
}
