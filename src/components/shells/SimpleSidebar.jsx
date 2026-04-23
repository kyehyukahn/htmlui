/* eslint-disable react/prop-types */
import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCameraRetro, faListCheck } from "@fortawesome/free-solid-svg-icons";
import { AuthContext } from "../../contexts/AuthContext";

const DEFAULT_ITEMS = [
  { to: "/snapshots", label: "Snapshots", icon: faCameraRetro, needsRepo: true, badgeFrom: null },
  { to: "/tasks", label: "Tasks", icon: faListCheck, needsRepo: true, badgeFrom: "runningTaskCount" },
];

/**
 * Vertical sidebar used by both SimpleShell (2 items) and FullShell (5 items).
 * Pass the `items` prop to customize; default = simple-mode items.
 *
 * item shape: { to, label, icon, needsRepo?, badgeFrom? }
 *   - needsRepo:   greys out the link when auth.isRepositoryConnected === false
 *   - badgeFrom:   name of a numeric AuthContext field to show as "(N)" suffix
 *                  when the value is > 0
 */
export function SimpleSidebar({ items = DEFAULT_ITEMS }) {
  const auth = useContext(AuthContext);
  const connected = !!auth.isRepositoryConnected;

  return (
    <aside className="vk-sidebar">
      <div className="vk-sidebar-brand">
        <img src="/kopia-flat.svg" alt="VaultKeeper" />
        <span className="vk-sidebar-name">
          <span className="vk-brand-accent">Vault</span>Keeper
        </span>
      </div>
      <nav className="vk-sidebar-nav">
        {items.map((item) => {
          const disabled = item.needsRepo && !connected;
          const badgeValue = item.badgeFrom ? auth[item.badgeFrom] : 0;
          const badge = badgeValue > 0 ? ` (${badgeValue})` : "";
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`nav-${item.to.replace(/^\//, "")}`}
              aria-disabled={disabled || undefined}
              className={({ isActive }) =>
                "vk-sidebar-link" +
                (isActive ? " active" : "") +
                (disabled ? " disabled" : "")
              }
              onClick={(e) => { if (disabled) e.preventDefault(); }}
            >
              <FontAwesomeIcon icon={item.icon} /> {item.label}{badge}
            </NavLink>
          );
        })}
      </nav>
      <div className="vk-sidebar-footer">
        v{import.meta.env.VITE_FULL_VERSION_INFO || "dev"}
      </div>
    </aside>
  );
}
