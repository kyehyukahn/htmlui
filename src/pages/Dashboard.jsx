/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { createVaultkeeperClient } from "../utils/vaultkeeperApi";

/*
 * Client-scoped dashboard page shown when the user clicks the header email.
 * Calls GET /api/v1/clients/me/summary (ApiKeyGuard) which aggregates stats
 * for the single client behind the current API key. Kept visually close to
 * vaultkeeper-frontend's (dashboard)/page.tsx, but the card set differs
 * because the scope is one device instead of the whole user.
 */

const PLACEHOLDER_SUMMARY = {
  client: { name: "", hostname: "", lastSeenAt: null },
  recentBackups: { success: 0, failed: 0 },
  recentRestores: 0,
  totalSnapshots: 0,
  storageUsedBytes: 0,
  consecutiveFailures: 0,
  lastBackupAt: null,
  lastBackupStatus: null,
};

const STAT_COLORS = {
  blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  red:    { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
  orange: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  gray:   { bg: "#f9fafb", border: "#e5e7eb", text: "#374151" },
};

function StatCard({ title, value, icon, color = "blue", subtitle }) {
  const c = STAT_COLORS[color] || STAT_COLORS.blue;
  return (
    <div
      className="vk-stat-card"
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
    >
      <div className="vk-stat-card-body">
        <div>
          <p className="vk-stat-card-title">{title}</p>
          <p className="vk-stat-card-value">{value}</p>
          {subtitle && <p className="vk-stat-card-subtitle">{subtitle}</p>}
        </div>
        {icon && <span className="vk-stat-card-icon">{icon}</span>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [placeholder, setPlaceholder] = useState(false);

  useEffect(() => {
    createVaultkeeperClient()
      .get("/clients/me/summary")
      .then((r) => setSummary(r.data))
      .catch(() => {
        setSummary(PLACEHOLDER_SUMMARY);
        setPlaceholder(true);
      });
  }, []);

  if (!summary) {
    return <div className="vk-dashboard-empty">Loading…</div>;
  }

  const recent = summary.recentBackups || { success: 0, failed: 0 };
  const totalBackups = (recent.success || 0) + (recent.failed || 0);
  const successRate =
    totalBackups > 0 ? Math.round(((recent.success || 0) / totalBackups) * 100) : 0;
  const storageGB = ((summary.storageUsedBytes || 0) / (1024 ** 3)).toFixed(2);
  const lastBackupText = summary.lastBackupAt
    ? new Date(summary.lastBackupAt).toLocaleString()
    : "—";
  const lastBackupStatus = summary.lastBackupStatus || "—";
  const clientLabel =
    summary.client?.name || summary.client?.hostname || "This client";

  return (
    <div className="vk-dashboard">
      <h1 className="vk-dashboard-title">Dashboard</h1>
      <p className="vk-dashboard-subtitle">
        {clientLabel} · Last 24 hours overview
      </p>

      {placeholder && (
        <div className="vk-dashboard-note">
          실데이터 연동 실패 — backend GET /clients/me/summary 호출이 실패했습니다.
          아래는 placeholder 값입니다.
        </div>
      )}

      <div className="vk-stat-grid vk-stat-grid-4">
        <StatCard
          title="Backup Success"
          value={`${successRate}%`}
          icon={"\u{2705}"}
          color={successRate >= 80 ? "green" : "red"}
          subtitle={`${recent.success} of ${totalBackups} (24h)`}
        />
        <StatCard
          title="Failed Backups"
          value={recent.failed}
          icon={"\u{274C}"}
          color={recent.failed > 0 ? "red" : "green"}
          subtitle="Last 24 hours"
        />
        <StatCard
          title="Recent Restores"
          value={summary.recentRestores}
          icon={"\u{1F504}"}
          color="orange"
          subtitle="Last 24 hours"
        />
        <StatCard
          title="Storage Used"
          value={`${storageGB} GB`}
          icon={"\u{1F4BE}"}
          color="gray"
          subtitle="This client"
        />
      </div>

      <div className="vk-stat-grid vk-stat-grid-2">
        <StatCard
          title="Total Snapshots"
          value={summary.totalSnapshots}
          icon={"\u{1F4F8}"}
          color="blue"
          subtitle="Lifetime"
        />
        <StatCard
          title="Consecutive Failures"
          value={summary.consecutiveFailures}
          icon={"\u{26A0}"}
          color={summary.consecutiveFailures > 0 ? "red" : "green"}
          subtitle={`Last backup: ${lastBackupStatus} · ${lastBackupText}`}
        />
      </div>
    </div>
  );
}
