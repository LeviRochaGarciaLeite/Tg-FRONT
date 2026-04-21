// ─── Utilitários de Resumo do Dia ────────────────────────────────────────────

/**
 * Formata segundos no padrão HH:mm:ss
 */
export function formatSeconds(totalSec) {
  if (totalSec == null || isNaN(totalSec)) return "00:00:00";
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/**
 * Formata um timestamp ISO para hora local (HH:mm:ss)
 */
export function formatTime(isoString) {
  if (!isoString) return "--:--:--";
  return new Date(isoString).toLocaleTimeString("pt-BR", { hour12: false });
}

/**
 * Formata uma data para exibição amigável
 */
export function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Calcula o total de pontos do dia
 */
export function calculateTotalPoints(positivePoints, negativePoints) {
  return (positivePoints ?? 0) - (negativePoints ?? 0);
}

// ─── Cenários de desempenho definidos pela empresa ───────────────────────────
//
// CENÁRIO BOM:
//   Conectado >= 6h30 | Trabalhado >= 6h | Pausa <= 30min
//   Início <= 08:30   | Pausas <= 2      | Atraso <= 1min
//
// CENÁRIO RUIM:
//   Conectado >= 5h30 | Trabalhado >= 5h | Pausa <= 35min
//   Início <= 08:35   | Pausas <= 3      | Atraso <= 5min
//
// PIOR CENÁRIO:
//   Abaixo de tudo acima

const SCENARIOS = {
  BOM: {
    minConnectedSec: 6 * 3600 + 30 * 60,   // 6h30
    minWorkedSec:    6 * 3600,              // 6h
    maxPauseSec:     30 * 60,               // 30min
    maxLateStartHour: 8,
    maxLateStartMin:  30,                   // até 08:30
    maxPauseCount:   2,
    maxLateSec:      1 * 60,               // 1min
    label: "Bom",
    color: "#00e87a",
    points: 100,
  },
  RUIM: {
    minConnectedSec: 5 * 3600 + 30 * 60,   // 5h30
    minWorkedSec:    5 * 3600,              // 5h
    maxPauseSec:     35 * 60,               // 35min
    maxLateStartHour: 8,
    maxLateStartMin:  35,                   // até 08:35
    maxPauseCount:   3,
    maxLateSec:      5 * 60,               // 5min
    label: "Ruim",
    color: "#f59e0b",
    points: 60,
  },
};

/**
 * Classifica a jornada em um dos 3 cenários e retorna
 * pontos positivos, negativos e o cenário identificado.
 *
 * @param {{
 *   connectedSec: number,
 *   workedSec: number,
 *   pauseSec: number,
 *   lateSec: number,
 *   pauseCount: number,
 *   startTime: number|null,  // timestamp ms
 * }} metrics
 */
export function calcularPontosPorCenario(metrics) {
  const {
    connectedSec = 0,
    workedSec = 0,
    pauseSec = 0,
    lateSec = 0,
    pauseCount = 0,
    startTime = null,
  } = metrics;

  // Hora/minuto de início real
  let startHour = 8, startMin = 0;
  if (startTime) {
    const d = new Date(startTime);
    startHour = d.getHours();
    startMin  = d.getMinutes();
  }

  // ── Verifica CENÁRIO BOM ──────────────────────────────────────────────────
  const isBom =
    connectedSec >= SCENARIOS.BOM.minConnectedSec &&
    workedSec    >= SCENARIOS.BOM.minWorkedSec    &&
    pauseSec     <= SCENARIOS.BOM.maxPauseSec      &&
    pauseCount   <= SCENARIOS.BOM.maxPauseCount    &&
    lateSec      <= SCENARIOS.BOM.maxLateSec       &&
    (startHour < SCENARIOS.BOM.maxLateStartHour ||
     (startHour === SCENARIOS.BOM.maxLateStartHour && startMin <= SCENARIOS.BOM.maxLateStartMin));

  if (isBom) {
    // Pontuação BOM: começa em 100, deduz detalhes menores
    let positivePoints = 100;
    let negativePoints = 0;

    // Bônus por pausa zero
    if (pauseCount === 0) positivePoints += 10;

    // Bônus por chegar antes das 08:00
    if (startHour < 8) positivePoints += 5;

    // Dedução por cada pausa além de 1
    if (pauseCount > 1) negativePoints += (pauseCount - 1) * 5;

    // Dedução por atraso (cada minuto = -2pts)
    if (lateSec > 0) negativePoints += Math.ceil(lateSec / 60) * 2;

    return {
      cenario: "BOM",
      label: "Bom",
      color: SCENARIOS.BOM.color,
      positivePoints,
      negativePoints,
    };
  }

  // ── Verifica CENÁRIO RUIM ─────────────────────────────────────────────────
  const isRuim =
    connectedSec >= SCENARIOS.RUIM.minConnectedSec &&
    workedSec    >= SCENARIOS.RUIM.minWorkedSec    &&
    pauseSec     <= SCENARIOS.RUIM.maxPauseSec      &&
    pauseCount   <= SCENARIOS.RUIM.maxPauseCount    &&
    lateSec      <= SCENARIOS.RUIM.maxLateSec       &&
    (startHour < SCENARIOS.RUIM.maxLateStartHour ||
     (startHour === SCENARIOS.RUIM.maxLateStartHour && startMin <= SCENARIOS.RUIM.maxLateStartMin));

  if (isRuim) {
    let positivePoints = 60;
    let negativePoints = 10; // penalidade base do cenário ruim

    // Dedução por cada pausa além de 2
    if (pauseCount > 2) negativePoints += (pauseCount - 2) * 8;

    // Dedução por atraso (cada minuto = -4pts)
    if (lateSec > 0) negativePoints += Math.ceil(lateSec / 60) * 4;

    // Dedução por cada 10min a mais de pausa
    const pausaExtra = Math.max(0, pauseSec - SCENARIOS.BOM.maxPauseSec);
    negativePoints += Math.ceil(pausaExtra / 600) * 3;

    return {
      cenario: "RUIM",
      label: "Ruim",
      color: SCENARIOS.RUIM.color,
      positivePoints,
      negativePoints,
    };
  }

  // ── PIOR CENÁRIO ──────────────────────────────────────────────────────────
  let positivePoints = Math.max(0, Math.round((workedSec / (5 * 3600)) * 40));
  let negativePoints = 30; // penalidade base pior cenário

  // Agrava por cada pausa além de 3
  if (pauseCount > 3) negativePoints += (pauseCount - 3) * 10;

  // Agrava por atraso
  if (lateSec > 0) negativePoints += Math.ceil(lateSec / 60) * 5;

  return {
    cenario: "PIOR",
    label: "Pior",
    color: "#ef4444",
    positivePoints,
    negativePoints,
  };
}

/**
 * Determina a classificação de desempenho com base nos pontos
 */
export function getPerformanceRating(totalPoints) {
  if (totalPoints >= 90)  return { label: "Excelente", color: "#00e87a" };
  if (totalPoints >= 70)  return { label: "Bom",       color: "#4db8ff" };
  if (totalPoints >= 50)  return { label: "Regular",   color: "#f59e0b" };
  return { label: "Abaixo do esperado", color: "#ef4444" };
}

/**
 * Constrói o DailySummary a partir do estado local do App.
 * Usa o sistema de cenários da empresa para calcular pontos.
 */
export function buildSummaryFromLocalState(appState) {
  const {
    startTime,
    connectedSec = 0,
    workedSec    = 0,
    totalPauseSec = 0,
    pauseLog      = [],
  } = appState;

  // Atraso: diferença entre início real e 08:00
  let lateTimeInSeconds = 0;
  if (startTime) {
    const expectedStart = new Date(startTime);
    expectedStart.setHours(8, 0, 0, 0);
    const diff = Math.floor((startTime - expectedStart.getTime()) / 1000);
    lateTimeInSeconds = diff > 0 ? diff : 0;
  }

  // Calcula pontos pelos cenários reais
  const { positivePoints, negativePoints, cenario, label, color } =
    calcularPontosPorCenario({
      connectedSec,
      workedSec,
      pauseSec:   totalPauseSec,
      lateSec:    lateTimeInSeconds,
      pauseCount: pauseLog.length,
      startTime,
    });

  return {
    connectedTimeInSeconds: connectedSec,
    workedTimeInSeconds:    workedSec,
    pauseTimeInSeconds:     totalPauseSec,
    startedAt:   startTime ? new Date(startTime).toISOString() : null,
    pauseCount:  pauseLog.length,
    lateTimeInSeconds,
    positivePoints,
    negativePoints,
    cenario,
    cenarioLabel: label,
    cenarioColor: color,
  };
}
