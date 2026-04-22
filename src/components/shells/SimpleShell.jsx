import React, { useContext, useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Snapshots } from "../../pages/Snapshots";
import { SnapshotCreate } from "../../pages/SnapshotCreate";
import { SnapshotHistory } from "../../pages/SnapshotHistory";
import { SnapshotDirectory } from "../../pages/SnapshotDirectory";
import { SnapshotRestore } from "../../pages/SnapshotRestore";
import { Tasks } from "../../pages/Tasks";
import { Task } from "../../pages/Task";
import { AppContext } from "../../contexts/AppContext";
import { UIPreferenceProvider } from "../../contexts/UIPreferencesContext";
import { AuthContext } from "../../contexts/AuthContext";
import { SimpleSidebar } from "./SimpleSidebar";
import { SimpleHeader } from "./SimpleHeader";

export function SimpleShell() {
  const auth = useContext(AuthContext);

  const appAdapter = useMemo(() => ({
    repositoryUpdated: (connected) => auth.setRepositoryConnected(connected),
    repositoryDescriptionUpdated: (desc) => auth.setRepoDescription(desc),
    runningTaskCount: auth.runningTaskCount,
    isRepositoryConnected: auth.isRepositoryConnected,
    logout: auth.logout,
  }), [auth]);

  return (
    <AppContext.Provider value={appAdapter}>
      <UIPreferenceProvider>
        <div className="vk-shell">
          <SimpleSidebar />
          <div className="vk-shell-body">
            <SimpleHeader />
            <main className="vk-shell-main">
              <Routes>
                <Route path="snapshots" element={<Snapshots />} />
                <Route path="snapshots/new" element={<SnapshotCreate />} />
                <Route path="snapshots/single-source/" element={<SnapshotHistory />} />
                <Route path="snapshots/dir/:oid" element={<SnapshotDirectory />} />
                <Route path="snapshots/dir/:oid/restore" element={<SnapshotRestore />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="tasks/:tid" element={<Task />} />
                <Route path="*" element={<Navigate to="/snapshots" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </UIPreferenceProvider>
    </AppContext.Provider>
  );
}
