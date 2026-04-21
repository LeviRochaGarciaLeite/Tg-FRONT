import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { buildSummaryFromLocalState } from "../utils/dailySummary";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Hook que monta o Resumo do Dia.
 *
 * Estratégia de prioridade:
 *   1. Se localAppState existe e tem startTime → calcula tudo localmente
 *      (dados do App são os mais precisos: foram registrados em tempo real).
 *   2. Tenta complementar com dados do backend (pontos históricos, etc.).
 *   3. Se o backend falhar, usa apenas o estado local — nunca dados aleatórios.
 *
 * @param {object|null} localAppState
 */
export function useDailySummary(localAppState = null) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    // ── Passo 1: constrói o resumo local se tiver dados reais ───────────────
    const temDadosLocais = localAppState && localAppState.startTime;
    const localSummary   = temDadosLocais
      ? buildSummaryFromLocalState(localAppState)
      : null;

    // ── Passo 2: tenta buscar complemento no backend ─────────────────────────
    try {
      const { data } = await axios.get(`${API_BASE}/ponto/resumo-dia`, {
        headers: getAuthHeader(),
        timeout: 5000,
      });

      if (temDadosLocais) {
        // Dados locais têm prioridade para tempos e pontuação.
        // Do backend só aproveitamos campos que o front não tem (ex: histórico).
        setSummary({
          ...data,
          // Sobrescreve com os valores locais — eles são os corretos
          connectedTimeInSeconds: localSummary.connectedTimeInSeconds,
          workedTimeInSeconds:    localSummary.workedTimeInSeconds,
          pauseTimeInSeconds:     localSummary.pauseTimeInSeconds,
          startedAt:              localSummary.startedAt,
          pauseCount:             localSummary.pauseCount,
          lateTimeInSeconds:      localSummary.lateTimeInSeconds,
          positivePoints:         localSummary.positivePoints,
          negativePoints:         localSummary.negativePoints,
          cenario:                localSummary.cenario,
          cenarioLabel:           localSummary.cenarioLabel,
          cenarioColor:           localSummary.cenarioColor,
        });
      } else {
        // Sem dados locais: usa tudo do backend
        // Mas se o backend não enviou pontos calculados, não exibe lixo
        if (data.positivePoints == null) {
          setSummary({ ...data, positivePoints: 0, negativePoints: 0 });
        } else {
          setSummary(data);
        }
      }
    } catch {
      // ── Passo 3: fallback — local ou erro ──────────────────────────────────
      if (localSummary) {
        setSummary(localSummary);
      } else {
        setError("Não foi possível carregar o resumo do dia.");
      }
    } finally {
      setLoading(false);
    }
  }, [localAppState]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}
