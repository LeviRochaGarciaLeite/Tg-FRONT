import React, { useEffect, useRef } from "react";
import { useDailySummary } from "../hooks/useDailySummary.js";
import { StatCard } from "./StatCard";
import { PointsPanel } from "./PointsPanel";
import { formatSeconds, formatTime, formatDate } from "../utils/dailySummary";
import "./DailySummary.css";
import ProductivityChart from "../ProductivityChart";


/**
 * Tela de Resumo do Dia.
 *
 * Props:
 * - localAppState: estado atual do App (startTime, pauseLog, connectedSec, etc.)
 *   Usado como fallback se o backend não tiver o endpoint de resumo.
 * - onClose: callback chamado ao clicar em "Voltar ao Login"
 * - userName: nome do usuário logado
 */
export function DailySummaryScreen({ localAppState, onClose, userName }) {
  const { summary, loading, error } = useDailySummary(localAppState);
  const containerRef = useRef(null);

  // Animação de entrada nos cards
  useEffect(() => {
    if (!summary || !containerRef.current) return;
    const cards = containerRef.current.querySelectorAll(".ds-stat-card, .ds-points-panel, .ds-hero");
    cards.forEach((card, i) => {
      card.style.animationDelay = `${i * 80}ms`;
      card.classList.add("ds-fade-in");
    });
  }, [summary]);

  const firstName = userName ? userName.split(" ")[0] : "Colaborador";
  const today = new Date().toISOString();

  if (loading) {
    return (
      <div className="ds-wrapper ds-wrapper--loading">
        <div className="ds-spinner" />
        <p className="ds-loading-text">Calculando seu resumo do dia…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="ds-wrapper ds-wrapper--error">
        <span className="ds-error-icon">⚠</span>
        <p className="ds-error-text">{error}</p>
        <button className="ds-btn-primary" onClick={onClose}>
          Voltar ao Login
        </button>
      </div>
    );
  }

  return (
    <div className="ds-wrapper" ref={containerRef}>
      {/* Elementos de fundo decorativos */}
      <div className="ds-bg-glow ds-bg-glow--1" aria-hidden="true" />
      <div className="ds-bg-glow ds-bg-glow--2" aria-hidden="true" />
      <div className="ds-scanlines" aria-hidden="true" />

      <div className="ds-container">
        {/* Hero Section */}
        <header className="ds-hero">
          <div className="ds-hero__tag">RESUMO DO DIA</div>
          <h1 className="ds-hero__title">
            Até logo, <span className="ds-hero__name">{firstName}</span>
          </h1>
          <p className="ds-hero__date">{formatDate(today)}</p>
        </header>

        {/* Linha: Início e Pausas */}
        <section className="ds-section">
          <div className="ds-grid ds-grid--2">
            <StatCard
              icon="🕐"
              label="Horário de Início"
              value={formatTime(summary.startedAt)}
              accent="#a78bfa"
            />
            <StatCard
              icon="⏸"
              label="Quantidade de Pausas"
              value={summary.pauseCount ?? 0}
              accent="#f59e0b"
            />
          </div>
        </section>

        {/* Linha: Tempos */}
        <section className="ds-section">
          <h2 className="ds-section__title">Tempos</h2>
          <div className="ds-grid ds-grid--3">
            <StatCard
              icon="🔗"
              label="Tempo Conectado"
              value={formatSeconds(summary.connectedTimeInSeconds)}
              accent="#4db8ff"
            />
            <StatCard
              icon="💼"
              label="Tempo Trabalhado"
              value={formatSeconds(summary.workedTimeInSeconds)}
              accent="#00e5a0"
            />
            <StatCard
              icon="☕"
              label="Tempo em Pausas"
              value={formatSeconds(summary.pauseTimeInSeconds)}
              accent="#f59e0b"
            />
          </div>

          {summary.lateTimeInSeconds > 0 && (
            <div className="ds-late-alert">
              <span className="ds-late-alert__icon">⚠</span>
              <span>
                Atraso registrado:{" "}
                <strong>{formatSeconds(summary.lateTimeInSeconds)}</strong>
              </span>
            </div>
          )}
        </section>

<section className="ds-section">
  <ProductivityChart />
</section>
        {/* Pontuação */}
        <section className="ds-section">
          <PointsPanel
            positivePoints={summary.positivePoints}
            negativePoints={summary.negativePoints}
          />
        </section>

        {/* Ação */}
        <footer className="ds-footer">
          <button className="ds-btn-primary" onClick={onClose} aria-label="Voltar ao login">
            Encerrar Sessão
          </button>
          <p className="ds-footer__hint">Até o próximo dia de trabalho 👋</p>
        </footer>
      </div>
    </div>
  );
}
