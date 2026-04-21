import React from "react";
import { calculateTotalPoints, getPerformanceRating } from "../utils/dailySummary.js";

/**
 * Painel de pontuação do dia.
 * Exibe o cenário identificado (Bom / Ruim / Pior),
 * pontos positivos, negativos e saldo final.
 */
export function PointsPanel({ positivePoints, negativePoints, cenario, cenarioLabel, cenarioColor }) {
  const pos   = positivePoints ?? 0;
  const neg   = negativePoints ?? 0;
  const total = calculateTotalPoints(pos, neg);
  const rating = getPerformanceRating(total);

  // Cor do cenário vinda dos dados (prioridade) ou calculada pelos pontos
  const displayColor = cenarioColor || rating.color;
  const displayLabel = cenarioLabel || rating.label;

  const progressPct = Math.min(100, Math.max(0, total));

  // Badge do cenário
  const cenarioBadge = {
    BOM:  { bg: "rgba(0,232,122,0.12)",  border: "rgba(0,232,122,0.35)",  text: "#00e87a" },
    RUIM: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", text: "#f59e0b" },
    PIOR: { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  text: "#ef4444" },
  };
  const badge = cenario ? cenarioBadge[cenario] : null;

  return (
    <div className="ds-points-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 className="ds-points-title" style={{ margin: 0 }}>Pontuação do Dia</h3>

        {badge && (
          <span style={{
            background:   badge.bg,
            border:       `1px solid ${badge.border}`,
            color:        badge.text,
            fontFamily:   "var(--display, 'Rajdhani', sans-serif)",
            fontSize:     11,
            fontWeight:   700,
            letterSpacing: 1.5,
            padding:      "4px 12px",
            borderRadius: 20,
            textTransform: "uppercase",
          }}>
            {cenario === "BOM"  && "✓ Cenário Bom"}
            {cenario === "RUIM" && "⚠ Cenário Ruim"}
            {cenario === "PIOR" && "✗ Pior Cenário"}
          </span>
        )}
      </div>

      <div className="ds-points-grid">
        {/* Pontos Positivos */}
        <div className="ds-points-block ds-points-block--positive">
          <span className="ds-points-block__icon">+</span>
          <span className="ds-points-block__value">{pos}</span>
          <span className="ds-points-block__label">Positivos</span>
        </div>

        {/* Pontos Negativos */}
        <div className="ds-points-block ds-points-block--negative">
          <span className="ds-points-block__icon">−</span>
          <span className="ds-points-block__value">{neg}</span>
          <span className="ds-points-block__label">Negativos</span>
        </div>

        {/* Saldo Final */}
        <div
          className="ds-points-block ds-points-block--total"
          style={{ "--total-color": displayColor }}
        >
          <span className="ds-points-block__label">Saldo Final</span>
          <span className="ds-points-block__value ds-points-block__value--total">
            {total > 0 ? `+${total}` : total}
          </span>
          <span className="ds-points-block__rating">{displayLabel}</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="ds-progress-bar">
        <div
          className="ds-progress-bar__fill"
          style={{
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${displayColor}66, ${displayColor})`,
          }}
        />
      </div>
      <div className="ds-progress-labels">
        <span>0</span>
        <span>50</span>
        <span>100+</span>
      </div>

      {/* Critérios do cenário */}
      {cenario && (
        <div style={{
          marginTop: 16,
          padding: "12px 14px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          fontSize: 11,
          color: "var(--text-mid, #7a9bbf)",
          fontFamily: "var(--mono, monospace)",
          lineHeight: 1.7,
        }}>
          {cenario === "BOM" && (
            <>
              <span style={{ color: "#00e87a", fontWeight: 700 }}>CENÁRIO BOM</span> — Conectado ≥ 6h30 · Trabalhado ≥ 6h · Pausas ≤ 30min · Início ≤ 08:30 · Pausas ≤ 2 · Atraso ≤ 1min
            </>
          )}
          {cenario === "RUIM" && (
            <>
              <span style={{ color: "#f59e0b", fontWeight: 700 }}>CENÁRIO RUIM</span> — Conectado ≥ 5h30 · Trabalhado ≥ 5h · Pausas ≤ 35min · Início ≤ 08:35 · Pausas ≤ 3 · Atraso ≤ 5min
            </>
          )}
          {cenario === "PIOR" && (
            <>
              <span style={{ color: "#ef4444", fontWeight: 700 }}>PIOR CENÁRIO</span> — Abaixo dos requisitos mínimos estabelecidos pela empresa
            </>
          )}
        </div>
      )}
    </div>
  );
}
