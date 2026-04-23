/* eslint-disable react/prop-types */
import React, { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../../contexts/AppContext";
import { UIPreferenceProvider } from "../../contexts/UIPreferencesContext";
import { AuthContext } from "../../contexts/AuthContext";
import { SimpleSidebar } from "./SimpleSidebar";
import { SimpleHeader } from "./SimpleHeader";

/**
 * Common shell used by both SimpleShell and FullShell.
 *
 * The two modes share every visual and behavioral aspect of the chrome —
 * the only differences are (1) the sidebar nav items they receive and
 * (2) the <Routes> children they render. Everything else (layout, header,
 * AppContext adapter, UIPreferenceProvider, soft-navigation behavior on
 * repository connect/disconnect) lives here so a change in one mode
 * automatically applies to the other.
 */
export function Shell({ navItems, children }) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const appAdapter = useMemo(() => ({
    repositoryUpdated: (connected) => {
      auth.setRepositoryConnected(connected);
      navigate(connected ? "/snapshots" : "/repo", { replace: true });
    },
    repositoryDescriptionUpdated: (desc) => auth.setRepoDescription(desc),
    runningTaskCount: auth.runningTaskCount,
    isRepositoryConnected: auth.isRepositoryConnected,
    logout: auth.logout,
  }), [auth, navigate]);

  return (
    <AppContext.Provider value={appAdapter}>
      <UIPreferenceProvider>
        <div className="vk-shell">
          <SimpleSidebar items={navItems} />
          <div className="vk-shell-body">
            <SimpleHeader />
            <main className="vk-shell-main">{children}</main>
          </div>
        </div>
      </UIPreferenceProvider>
    </AppContext.Provider>
  );
}
