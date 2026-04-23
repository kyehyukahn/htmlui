import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { faCameraRetro, faListCheck } from "@fortawesome/free-solid-svg-icons";
import { Snapshots } from "../../pages/Snapshots";
import { SnapshotCreate } from "../../pages/SnapshotCreate";
import { SnapshotHistory } from "../../pages/SnapshotHistory";
import { SnapshotDirectory } from "../../pages/SnapshotDirectory";
import { SnapshotRestore } from "../../pages/SnapshotRestore";
import { Tasks } from "../../pages/Tasks";
import { Task } from "../../pages/Task";
import { Repository } from "../../pages/Repository";
import { Dashboard } from "../../pages/Dashboard";
import { Shell } from "./Shell";

const SIMPLE_ITEMS = [
  { to: "/snapshots", label: "Snapshots", icon: faCameraRetro, needsRepo: true },
  { to: "/tasks",     label: "Tasks",     icon: faListCheck,   needsRepo: true, badgeFrom: "runningTaskCount" },
];

export function SimpleShell() {
  return (
    <Shell navItems={SIMPLE_ITEMS}>
      <Routes>
        <Route path="snapshots" element={<Snapshots />} />
        <Route path="snapshots/new" element={<SnapshotCreate />} />
        <Route path="snapshots/single-source/" element={<SnapshotHistory />} />
        <Route path="snapshots/dir/:oid" element={<SnapshotDirectory />} />
        <Route path="snapshots/dir/:oid/restore" element={<SnapshotRestore />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:tid" element={<Task />} />
        <Route path="repo" element={<Repository />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/snapshots" replace />} />
      </Routes>
    </Shell>
  );
}
