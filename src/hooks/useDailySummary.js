import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { buildSummaryFromLocalState } from "../utils/dailySummary";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Hook que busca o Resumo do Dia.
 * Tenta o endpoint do backend. Se falhar, usa o estado local.
 *
 * @param {object|null} localAppState - Estado atual do App (startTime, pauseLog, etc.)
 * @returns {{ summary: DailySummary|null, loading: boolean, error: string|null, refetch: Function }}
 */
export function useDailySummary(localAppState = null) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await axios.get(`${API_BASE}/ponto/resumo-dia`, {
        headers: getAuthHeader(),
      });
      setSummary(data);
    } catch (err) {
      // Fallback para estado local se backend não tiver o endpoint
      if (localAppState) {
        const localSummary = buildSummaryFromLocalState(localAppState);
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
