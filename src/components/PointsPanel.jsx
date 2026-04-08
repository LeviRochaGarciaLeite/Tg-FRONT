import React from "react";
import { calculateTotalPoints, getPerformanceRating } from "../utils/dailySummary.js";

/**
 * Painel de pontuação do dia.
 * Exibe positivos, negativos e saldo final com barra de progresso.
 */
export function PointsPanel({ positivePoints, negativePoints }) {
  const total = calculateTotalPoints(positivePoints, negativePoints);
  const rating = getPerformanceRating(total);
  const progressPct = Math.min(100, Math.max(0, total));

  return (
    <div className="ds-points-panel">
      <h3 className="ds-points-title">Pontuação do Dia</h3>

      <div className="ds-points-grid">
        <div className="ds-points-block ds-points-block--positive">
          <span className="ds-points-block__icon">+</span>
          <span className="ds-points-block__value">{positivePoints ?? 0}</span>
          <span className="ds-points-block__label">Positivos</span>
        </div>

        <div className="ds-points-block ds-points-block--negative">
          <span className="ds-points-block__icon">−</span>
          <span className="ds-points-block__value">{negativePoints ?? 0}</span>
          <span className="ds-points-block__label">Negativos</span>
        </div>

        <div className="ds-points-block ds-points-block--total" style={{ "--total-color": rating.color }}>
          <span className="ds-points-block__label">Saldo Final</span>
          <span className="ds-points-block__value ds-points-block__value--total">
            {total > 0 ? `+${total}` : total}
          </span>
          <span className="ds-points-block__rating">{rating.label}</span>
        </div>
      </div>

      <div className="ds-progress-bar">
        <div
          className="ds-progress-bar__fill"
          style={{
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${rating.color}66, ${rating.color})`,
          }}
        />
      </div>
      <div className="ds-progress-labels">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}
