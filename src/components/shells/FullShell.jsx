import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  faCameraRetro,
  faListCheck,
  faShieldHalved,
  faDatabase,
  faGear,
} from "@fortawesome/free-solid-svg-icons";
import { Policy } from "../../pages/Policy";
import { Preferences } from "../../pages/Preferences";
import { Policies } from "../../pages/Policies";
import { Repository } from "../../pages/Repository";
import { Task } from "../../pages/Task";
import { Tasks } from "../../pages/Tasks";
import { Snapshots } from "../../pages/Snapshots";
import { SnapshotCreate } from "../../pages/SnapshotCreate";
import { SnapshotDirectory } from "../../pages/SnapshotDirectory";
import { SnapshotHistory } from "../../pages/SnapshotHistory";
import { SnapshotRestore } from "../../pages/SnapshotRestore";
import { Dashboard } from "../../pages/Dashboard";
import { Shell } from "./Shell";

const FULL_ITEMS = [
  { to: "/snapshots",   label: "Snapshots",   icon: faCameraRetro,  needsRepo: true },
  { to: "/policies",    label: "Policies",    icon: faShieldHalved, needsRepo: true },
  { to: "/tasks",       label: "Tasks",       icon: faListCheck,    needsRepo: true, badgeFrom: "runningTaskCount" },
  { to: "/repo",        label: "Repository",  icon: faDatabase },
  { to: "/preferences", label: "Preferences", icon: faGear },
];

export function FullShell() {
  return (
    <Shell navItems={FULL_ITEMS}>
      <Routes>
        <Route path="snapshots" element={<Snapshots />} />
        <Route path="snapshots/new" element={<SnapshotCreate />} />
        <Route path="snapshots/single-source/" element={<SnapshotHistory />} />
        <Route path="snapshots/dir/:oid/restore" element={<SnapshotRestore />} />
        <Route path="snapshots/dir/:oid" element={<SnapshotDirectory />} />
        <Route path="policies/edit/" element={<Policy />} />
        <Route path="policies" element={<Policies />} />
        <Route path="tasks/:tid" element={<Task />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="repo" element={<Repository />} />
        <Route path="preferences" element={<Preferences />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="/" element={<Navigate to="/snapshots" />} />
      </Routes>
    </Shell>
  );
}
