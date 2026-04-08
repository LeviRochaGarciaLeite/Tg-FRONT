// ─── Utilitários de Resumo do Dia ────────────────────────────────────────────

/**
 * Formata segundos no padrão HH:mm:ss
 * @param {number} totalSec
 * @returns {string}
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
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatTime(isoString) {
  if (!isoString) return "--:--:--";
  return new Date(isoString).toLocaleTimeString("pt-BR", { hour12: false });
}

/**
 * Formata uma data para exibição amigável
 * @param {string|null} isoString
 * @returns {string}
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
 * @param {number} positivePoints
 * @param {number} negativePoints
 * @returns {number}
 */
export function calculateTotalPoints(positivePoints, negativePoints) {
  return (positivePoints ?? 0) - (negativePoints ?? 0);
}

/**
 * Determina a classificação de desempenho com base nos pontos
 * @param {number} totalPoints
 * @returns {{ label: string, color: string }}
 */
export function getPerformanceRating(totalPoints) {
  if (totalPoints >= 90) return { label: "Excelente", color: "#00e5a0" };
  if (totalPoints >= 70) return { label: "Bom", color: "#4db8ff" };
  if (totalPoints >= 50) return { label: "Regular", color: "#f59e0b" };
  return { label: "Abaixo do esperado", color: "#ef4444" };
}

/**
 * Constrói o objeto DailySummary a partir do estado local do App
 * (usado como fallback quando o backend não está disponível)
 *
 * @param {{
 *   startTime: number|null,
 *   endTime: number|null,
 *   pauseLog: Array<{in: number, out: number|null}>,
 *   connectedSec: number,
 *   workedSec: number,
 *   totalPauseSec: number,
 * }} appState
 * @returns {import('../types/dailySummary').DailySummary}
 */
export function buildSummaryFromLocalState(appState) {
  const {
    startTime,
    connectedSec = 0,
    workedSec = 0,
    totalPauseSec = 0,
    pauseLog = [],
  } = appState;

  // Heurística simples de pontuação baseada em tempo trabalhado
  const jornadaEsperadaSeg = 8 * 3600; // 8h
  const percentWorked = Math.min(100, (workedSec / jornadaEsperadaSeg) * 100);
  const positivePoints = Math.round(percentWorked);
  const negativePoints = Math.max(0, Math.round((totalPauseSec / 3600) * 5)); // -5 pts por hora de pausa

  // Atraso: se iniciou depois das 08:00
  let lateTimeInSeconds = 0;
  if (startTime) {
    const expectedStart = new Date(startTime);
    expectedStart.setHours(8, 0, 0, 0);
    const diff = Math.floor((startTime - expectedStart.getTime()) / 1000);
    lateTimeInSeconds = diff > 0 ? diff : 0;
  }

  return {
    connectedTimeInSeconds: connectedSec,
    workedTimeInSeconds: workedSec,
    pauseTimeInSeconds: totalPauseSec,
    startedAt: startTime ? new Date(startTime).toISOString() : null,
    pauseCount: pauseLog.length,
    lateTimeInSeconds,
    positivePoints,
    negativePoints,
  };
}
