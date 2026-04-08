import React from "react";

/**
 * Card de estatística individual.
 * Exibe um ícone, rótulo e valor com destaque visual.
 */
export function StatCard({ icon, label, value, accent = "#4db8ff", small = false }) {
  return (
    <div className="ds-stat-card" style={{ "--accent": accent }}>
      <div className="ds-stat-icon">{icon}</div>
      <div className="ds-stat-content">
        <span className="ds-stat-label">{label}</span>
        <span className={`ds-stat-value ${small ? "ds-stat-value--small" : ""}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
