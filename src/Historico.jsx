import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, ReferenceLine,
} from "recharts";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtSeconds(totalSec) {
  const safe = Math.max(0, Math.floor(Number(totalSec || 0)));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function fmtTime(isoString) {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateFull(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getDayLabel(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
}

// ─── Tooltip customizado para o gráfico ─────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0d1422",
      border: "1px solid #2a4060",
      borderRadius: 8,
      padding: "10px 14px",
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: 13,
      color: "#e8f4ff",
    }}>
      <p style={{ marginBottom: 6, color: "#7a9bbf", fontWeight: 700, letterSpacing: 1 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill, margin: "2px 0" }}>
          {p.name}: <strong>{fmtSeconds(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Componente de card de stat ──────────────────────────────────────────────
const StatCard = ({ label, value, accent = "#00c8ff", sub }) => (
  <div style={{
    background: "#111927",
    border: `1px solid #1e2d42`,
    borderTop: `2px solid ${accent}`,
    borderRadius: 8,
    padding: "14px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }}>
    <span style={{
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: 11,
      letterSpacing: 2,
      color: "#7a9bbf",
      fontWeight: 600,
      textTransform: "uppercase",
    }}>{label}</span>
    <span style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 22,
      color: accent,
      letterSpacing: 1,
    }}>{value}</span>
    {sub && (
      <span style={{ fontSize: 11, color: "#3a5570", fontFamily: "'Rajdhani', sans-serif" }}>{sub}</span>
    )}
  </div>
);

// ─── Badge de atraso ─────────────────────────────────────────────────────────
const LateBadge = ({ seconds }) => {
  if (!seconds || seconds <= 0) return (
    <span style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 16,
      color: "#00e87a",
    }}>00:00:00</span>
  );
  return (
    <span style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 16,
      color: "#ff3b55",
    }}>{fmtSeconds(seconds)}</span>
  );
};

// ─── Mock fallback (quando API indisponível) ─────────────────────────────────
function buildMockHistory() {
  const hoje = new Date();
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const connected = 27000 + Math.floor(Math.random() * 7200);
    const pauses = Math.floor(Math.random() * 4);
    const pauseTime = pauses * 600 + Math.floor(Math.random() * 600);
    const worked = connected - pauseTime;
    const late = Math.random() > 0.7 ? Math.floor(Math.random() * 1800) : 0;

    // Criar data de início de forma segura
    const startDate = new Date(d);
    startDate.setHours(8, late > 0 ? Math.floor(late / 60) : 0, 0, 0);

    dias.push({
      date: d.toISOString().split("T")[0],
      startedAt: startDate.toISOString(),
      connectedTimeInSeconds: connected,
      workedTimeInSeconds: worked,
      pauseTimeInSeconds: pauseTime,
      lateTimeInSeconds: late,
      pauseCount: pauses,
      positivePoints: Math.round((worked / 28800) * 100),
      negativePoints: pauses * 2 + (late > 0 ? 5 : 0),
    });
  }
  return dias;
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Historico({ userName }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = semana atual, -1 = semana anterior

  const firstName = userName
    ? userName.split(" ")[0]
    : localStorage.getItem("nexus_nome")?.split(" ")[0] || "Colaborador";

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API_BASE}/ponto/historico-dias`, {
        headers: getAuthHeader(),
        params: { dias: 14 },
      });
      // O novo endpoint retorna um array direto com resumos consolidados
      if (Array.isArray(data)) {
        setRecords(data);
      } else {
        console.warn("Formato inesperado da API:", data);
        setRecords(buildMockHistory());
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      setError(err.message);
      // fallback com dados mock
      setRecords(buildMockHistory());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Garante que records é um array
  const safeRecords = Array.isArray(records) ? records : [];

  // Filtra registros da semana selecionada
  const getWeekRecords = (offset) => {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay() + 1 + offset * 7);
    inicioSemana.setHours(0, 0, 0, 0);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 4);
    fimSemana.setHours(23, 59, 59, 999);

    return safeRecords.filter((r) => {
      const dateStr = r?.date || r?.data || r?.startedAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= inicioSemana && d <= fimSemana;
    });
  };

  const weekRecords = getWeekRecords(weekOffset);
  const prevWeekRecords = getWeekRecords(weekOffset - 1);

  // Hoje e ontem
  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayStr = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  const todayRecord = safeRecords.find((r) => (r.date || r.data || r.startedAt || "").startsWith(todayStr));
  const yesterdayRecord = safeRecords.find((r) => (r.date || r.data || r.startedAt || "").startsWith(yesterdayStr));

  // Dados para o gráfico comparativo hoje vs ontem
  const comparisonData = [
    {
      name: "Conectado",
      Hoje: todayRecord?.connectedTimeInSeconds || 0,
      Ontem: yesterdayRecord?.connectedTimeInSeconds || 0,
    },
    {
      name: "Trabalhado",
      Hoje: todayRecord?.workedTimeInSeconds || 0,
      Ontem: yesterdayRecord?.workedTimeInSeconds || 0,
    },
    {
      name: "Pausas",
      Hoje: todayRecord?.pauseTimeInSeconds || 0,
      Ontem: yesterdayRecord?.pauseTimeInSeconds || 0,
    },
  ];

  // Dados para o gráfico semanal
  const buildChartData = (weekRecs, label) =>
    weekRecs.map((r) => ({
      dia: getDayLabel(r.date || r.data || r.startedAt),
      Trabalhado: r.workedTimeInSeconds || 0,
      Pausa: r.pauseTimeInSeconds || 0,
      [`label_${label}`]: label,
    }));

  const chartData = buildChartData(weekRecords, "atual");

  // Totais da semana
  const weekTotals = (Array.isArray(weekRecords) ? weekRecords : []).reduce((acc, r) => ({
    connected: acc.connected + (r.connectedTimeInSeconds || 0),
    worked: acc.worked + (r.workedTimeInSeconds || 0),
    pauses: acc.pauses + (r.pauseTimeInSeconds || 0),
    late: acc.late + (r.lateTimeInSeconds || 0),
    points: acc.points + ((r.positivePoints || 0) - (r.negativePoints || 0)),
    days: acc.days + 1,
  }), { connected: 0, worked: 0, pauses: 0, late: 0, points: 0, days: 0 });

  const today = new Date();
  const weekLabel = weekOffset === 0
    ? "Semana Atual"
    : weekOffset === -1
    ? "Semana Anterior"
    : `${Math.abs(weekOffset)} semanas atrás`;

  return (
    <div style={{
      width: "100%",
      maxWidth: 900,
      margin: "0 auto",
      padding: "24px 16px",
      fontFamily: "'Exo 2', sans-serif",
      color: "#e8f4ff",
    }}>
      {/* ── Saudação ─────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #111927 0%, #0d1422 100%)",
        border: "1px solid #1e2d42",
        borderLeft: "3px solid #00c8ff",
        borderRadius: 10,
        padding: "16px 22px",
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}>
        <div style={{
          width: 8, height: 8,
          borderRadius: "50%",
          background: "#00c8ff",
          boxShadow: "0 0 10px #00c8ff",
          flexShrink: 0,
        }} />
        <div>
          <p style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#e8f4ff",
            margin: 0,
          }}>
            Olá, <span style={{ color: "#00c8ff" }}>{firstName}</span> — esse é seu resumo
          </p>
          <p style={{
            fontSize: 12,
            color: "#7a9bbf",
            fontFamily: "'Rajdhani', sans-serif",
            letterSpacing: 1,
            margin: "2px 0 0",
          }}>
            {fmtDateFull(today.toISOString())}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#7a9bbf" }}>
          <div style={{
            width: 36, height: 36,
            border: "3px solid #1e2d42",
            borderTop: "3px solid #00c8ff",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: 2 }}>
            CARREGANDO HISTÓRICO…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : error && records.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px 20px",
          background: "rgba(255,59,85,0.1)",
          border: "1px solid #ff3b55",
          borderRadius: 10,
          color: "#ff3b55",
        }}>
          <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16, margin: "0 0 10px" }}>
            ⚠️ Erro ao carregar histórico
          </p>
          <p style={{ fontSize: 13, color: "#7a9bbf", margin: 0 }}>
            {error}
          </p>
          <button
            onClick={fetchHistory}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: "#00c8ff",
              border: "none",
              borderRadius: 6,
              color: "#000",
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : (
        <>
          {/* ── Seção: Resumo do Dia de Hoje ─────────────────────────────── */}
          <section style={{ marginBottom: 28 }}>
            <SectionHeader title="RESUMO DO SEU DIA" />
            {todayRecord ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <StatCard label="Tempo Conectado" value={fmtSeconds(todayRecord.connectedTimeInSeconds)} accent="#00c8ff" />
                <StatCard label="Tempo Trabalhado" value={fmtSeconds(todayRecord.workedTimeInSeconds)} accent="#00e87a" />
                <StatCard label="Tempo Pausa" value={fmtSeconds(todayRecord.pauseTimeInSeconds)} accent="#f59e0b" />
                <StatCard
                  label="Iniciou Em"
                  value={fmtTime(todayRecord.startedAt)}
                  accent="#a78bfa"
                />
                <StatCard
                  label="Quantas Pausas"
                  value={String(todayRecord.pauseCount ?? 0).padStart(2, "0")}
                  accent="#f59e0b"
                />
                <div style={{
                  background: "#111927",
                  border: "1px solid #1e2d42",
                  borderTop: "2px solid #ff3b55",
                  borderRadius: 8,
                  padding: "14px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}>
                  <span style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 11,
                    letterSpacing: 2,
                    color: "#7a9bbf",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}>Tempo de Atraso</span>
                  <LateBadge seconds={todayRecord.lateTimeInSeconds} />
                </div>
              </div>
            ) : (
              <EmptyDay label="Nenhum registro de hoje ainda." />
            )}
          </section>

          {/* ── Seção: Resumo do Dia Anterior ────────────────────────────── */}
          {yesterdayRecord && (
            <section style={{ marginBottom: 28 }}>
              <SectionHeader
                title={`RESUMO DO DIA - ${fmtDate(yesterdayRecord.date || yesterdayRecord.startedAt)}`}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <StatCard label="Tempo Conectado" value={fmtSeconds(yesterdayRecord.connectedTimeInSeconds)} accent="#00c8ff" />
                <StatCard label="Tempo Trabalhado" value={fmtSeconds(yesterdayRecord.workedTimeInSeconds)} accent="#00e87a" />
                <StatCard label="Tempo Pausa" value={fmtSeconds(yesterdayRecord.pauseTimeInSeconds)} accent="#f59e0b" />
                <StatCard label="Iniciou Em" value={fmtTime(yesterdayRecord.startedAt)} accent="#a78bfa" />
                <StatCard label="Quantas Pausas" value={String(yesterdayRecord.pauseCount ?? 0).padStart(2, "0")} accent="#f59e0b" />
                <div style={{
                  background: "#111927",
                  border: "1px solid #1e2d42",
                  borderTop: "2px solid #ff3b55",
                  borderRadius: 8,
                  padding: "14px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}>
                  <span style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 11,
                    letterSpacing: 2,
                    color: "#7a9bbf",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}>Tempo de Atraso</span>
                  <LateBadge seconds={yesterdayRecord.lateTimeInSeconds} />
                </div>
              </div>
            </section>
          )}

          {/* ── Seção: Gráfico Comparativo Hoje vs Ontem ─────────────────── */}
          {(todayRecord || yesterdayRecord) && (
            <section style={{ marginBottom: 28 }}>
              <SectionHeader title="HOJE VS ONTEM" />
              <div style={{
                background: "#0d1422",
                border: "1px solid #1e2d42",
                borderRadius: 10,
                padding: "20px 16px",
              }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={comparisonData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#7a9bbf", fontFamily: "'Rajdhani', sans-serif", fontSize: 12, letterSpacing: 1 }}
                      axisLine={{ stroke: "#1e2d42" }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `${Math.floor(v / 3600)}h`}
                      tick={{ fill: "#3a5570", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,200,255,0.04)" }} />
                    <Legend
                      wrapperStyle={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontSize: 12,
                        letterSpacing: 1,
                        color: "#7a9bbf",
                      }}
                    />
                    <Bar dataKey="Hoje" fill="#00c8ff" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Ontem" fill="#1a6fff" radius={[4, 4, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* ── Seção: Seus Pontos ────────────────────────────────────────── */}
          <section style={{ marginBottom: 28 }}>
            <SectionHeader title="SEUS PONTOS" />
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              alignItems: "start",
            }}>
              {/* Pontos */}
              <div style={{
                background: "#111927",
                border: "1px solid #1e2d42",
                borderRadius: 10,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}>
                <div>
                  <p style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 11,
                    letterSpacing: 2,
                    color: "#7a9bbf",
                    margin: "0 0 4px",
                  }}>TOTAL DE PONTOS</p>
                  <p style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 40,
                    color: "#ffcc00",
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {weekTotals.points > 0 ? weekTotals.points : (todayRecord
                      ? (todayRecord.positivePoints || 0) - (todayRecord.negativePoints || 0)
                      : 0)}
                  </p>
                </div>
                <div>
                  <p style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 11,
                    letterSpacing: 2,
                    color: "#7a9bbf",
                    margin: "0 0 4px",
                  }}>MÉDIA DE PONTOS SEMANAL</p>
                  <p style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 28,
                    color: "#ffcc00",
                    margin: 0,
                  }}>
                    {weekTotals.days > 0 ? Math.round(weekTotals.points / weekTotals.days) : 0}
                  </p>
                </div>
              </div>

              {/* Gráfico semanal de pontos */}
              <div style={{
                background: "#0d1422",
                border: "1px solid #1e2d42",
                borderRadius: 10,
                padding: "16px",
              }}>
                <p style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "#7a9bbf",
                  margin: "0 0 12px",
                }}>GRÁFICO DA SUA JORNADA</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e2d42" vertical={false} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fill: "#7a9bbf", fontFamily: "'Rajdhani', sans-serif", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,200,255,0.04)" }} />
                    <Bar dataKey="Trabalhado" fill="#00e87a" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Pausa" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ── Seção: Histórico Semanal ──────────────────────────────────── */}
          <section style={{ marginBottom: 28 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}>
              <SectionHeader title={`HISTÓRICO — ${weekLabel.toUpperCase()}`} noMargin />
              <div style={{ display: "flex", gap: 8 }}>
                <NavBtn
                  onClick={() => setWeekOffset((v) => v - 1)}
                  label="← Anterior"
                />
                {weekOffset < 0 && (
                  <NavBtn
                    onClick={() => setWeekOffset((v) => Math.min(0, v + 1))}
                    label="Próxima →"
                  />
                )}
              </div>
            </div>

            {weekRecords.length === 0 ? (
              <EmptyDay label="Nenhum registro nessa semana." />
            ) : (
              <>
                {/* Totais da semana */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                  marginBottom: 16,
                }}>
                  <MiniStat label="Total Conectado" value={fmtSeconds(weekTotals.connected)} color="#00c8ff" />
                  <MiniStat label="Total Trabalhado" value={fmtSeconds(weekTotals.worked)} color="#00e87a" />
                  <MiniStat label="Total Pausas" value={fmtSeconds(weekTotals.pauses)} color="#f59e0b" />
                  <MiniStat label="Total Atrasos" value={fmtSeconds(weekTotals.late)} color={weekTotals.late > 0 ? "#ff3b55" : "#00e87a"} />
                </div>

                {/* Lista de dias */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {weekRecords.map((r) => {
                    const dateStr = r.date || r.data || r.startedAt?.split("T")[0];
                    const isToday = dateStr === todayStr;
                    const isSelected = selectedDay === dateStr;
                    const pts = (r.positivePoints || 0) - (r.negativePoints || 0);
                    const ptsColor = pts >= 70 ? "#00e87a" : pts >= 50 ? "#f59e0b" : "#ff3b55";

                    return (
                      <div key={dateStr}>
                        <button
                          onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                          style={{
                            width: "100%",
                            background: isSelected
                              ? "#0d1422"
                              : isToday
                              ? "rgba(0,200,255,0.06)"
                              : "#111927",
                            border: `1px solid ${isSelected ? "#2a4060" : isToday ? "rgba(0,200,255,0.3)" : "#1e2d42"}`,
                            borderLeft: `3px solid ${isToday ? "#00c8ff" : isSelected ? "#1a6fff" : "#1e2d42"}`,
                            borderRadius: 8,
                            padding: "12px 16px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            transition: "all 0.15s",
                            color: "#e8f4ff",
                            textAlign: "left",
                          }}
                        >
                          {/* Data */}
                          <div style={{ minWidth: 90 }}>
                            <p style={{
                              fontFamily: "'Rajdhani', sans-serif",
                              fontSize: 13,
                              fontWeight: 700,
                              letterSpacing: 1,
                              color: isToday ? "#00c8ff" : "#e8f4ff",
                              margin: 0,
                            }}>
                              {fmtDate(r.date || r.startedAt)}
                              {isToday && <span style={{ fontSize: 10, color: "#00c8ff", marginLeft: 6 }}>HOJE</span>}
                            </p>
                            <p style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: 11,
                              color: "#3a5570",
                              margin: "2px 0 0",
                            }}>{fmtTime(r.startedAt)} início</p>
                          </div>

                          {/* Tempos */}
                          <div style={{ flex: 1, display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <TimeChip label="Conectado" value={fmtSeconds(r.connectedTimeInSeconds)} color="#00c8ff" />
                            <TimeChip label="Trabalhado" value={fmtSeconds(r.workedTimeInSeconds)} color="#00e87a" />
                            <TimeChip label="Pausas" value={fmtSeconds(r.pauseTimeInSeconds)} color="#f59e0b" />
                            {r.lateTimeInSeconds > 0 && (
                              <TimeChip label="Atraso" value={fmtSeconds(r.lateTimeInSeconds)} color="#ff3b55" />
                            )}
                          </div>

                          {/* Pontos */}
                          <div style={{ textAlign: "right", minWidth: 60 }}>
                            <p style={{
                              fontFamily: "'Share Tech Mono', monospace",
                              fontSize: 20,
                              color: ptsColor,
                              margin: 0,
                              lineHeight: 1,
                            }}>{pts}</p>
                            <p style={{
                              fontFamily: "'Rajdhani', sans-serif",
                              fontSize: 10,
                              color: "#3a5570",
                              letterSpacing: 1,
                              margin: "2px 0 0",
                            }}>PTS</p>
                          </div>

                          {/* Chevron */}
                          <span style={{
                            color: "#3a5570",
                            fontSize: 14,
                            transition: "transform 0.2s",
                            transform: isSelected ? "rotate(180deg)" : "none",
                          }}>▼</span>
                        </button>

                        {/* Detalhes expandidos */}
                        {isSelected && (
                          <div style={{
                            background: "#0a1018",
                            border: "1px solid #1e2d42",
                            borderTop: "none",
                            borderRadius: "0 0 8px 8px",
                            padding: "16px",
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 10,
                            animation: "fadeIn 0.15s ease",
                          }}>
                            <DetailItem label="Horário de Início" value={fmtTime(r.startedAt)} />
                            <DetailItem label="Nº de Pausas" value={r.pauseCount ?? 0} />
                            <DetailItem
                              label="Atraso"
                              value={r.lateTimeInSeconds > 0 ? fmtSeconds(r.lateTimeInSeconds) : "Sem atraso"}
                              color={r.lateTimeInSeconds > 0 ? "#ff3b55" : "#00e87a"}
                            />
                            <DetailItem label="Pontos Positivos" value={`+${r.positivePoints ?? 0}`} color="#00e87a" />
                            <DetailItem label="Pontos Negativos" value={`-${r.negativePoints ?? 0}`} color="#ff3b55" />
                            <DetailItem label="Total de Pontos" value={pts} color={ptsColor} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Gráfico da semana */}
                {chartData.length > 0 && (
                  <div style={{
                    background: "#0d1422",
                    border: "1px solid #1e2d42",
                    borderRadius: 10,
                    padding: "20px 16px",
                    marginTop: 16,
                  }}>
                    <p style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontSize: 11,
                      letterSpacing: 2,
                      color: "#7a9bbf",
                      margin: "0 0 12px",
                    }}>JORNADA DA SEMANA — TRABALHADO VS PAUSAS</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={chartData} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" vertical={false} />
                        <XAxis
                          dataKey="dia"
                          tick={{ fill: "#7a9bbf", fontFamily: "'Rajdhani', sans-serif", fontSize: 12 }}
                          axisLine={{ stroke: "#1e2d42" }}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => `${Math.floor(v / 3600)}h`}
                          tick={{ fill: "#3a5570", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <ReferenceLine
                          y={28800}
                          stroke="#1a6fff"
                          strokeDasharray="4 4"
                          label={{ value: "8h", fill: "#1a6fff", fontSize: 10, fontFamily: "'Rajdhani', sans-serif" }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,200,255,0.04)" }} />
                        <Legend
                          wrapperStyle={{
                            fontFamily: "'Rajdhani', sans-serif",
                            fontSize: 12,
                            letterSpacing: 1,
                            color: "#7a9bbf",
                          }}
                        />
                        <Bar dataKey="Trabalhado" fill="#00e87a" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Pausa" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.8} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Sub-componentes auxiliares ────────────────────────────────────────────────

function SectionHeader({ title, noMargin }) {
  return (
    <div style={{
      marginBottom: noMargin ? 0 : 14,
      paddingBottom: 10,
      borderBottom: "1px solid #1e2d42",
    }}>
      <h2 style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 3,
        color: "#7a9bbf",
        margin: 0,
        textTransform: "uppercase",
      }}>{title}</h2>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{
      background: "#0d1422",
      border: "1px solid #1e2d42",
      borderRadius: 6,
      padding: "10px 12px",
    }}>
      <p style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 10,
        letterSpacing: 1.5,
        color: "#3a5570",
        margin: "0 0 3px",
        textTransform: "uppercase",
      }}>{label}</p>
      <p style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 14,
        color,
        margin: 0,
      }}>{value}</p>
    </div>
  );
}

function TimeChip({ label, value, color }) {
  return (
    <div>
      <p style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 9,
        letterSpacing: 1.5,
        color: "#3a5570",
        margin: "0 0 1px",
        textTransform: "uppercase",
      }}>{label}</p>
      <p style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 13,
        color,
        margin: 0,
      }}>{value}</p>
    </div>
  );
}

function DetailItem({ label, value, color = "#e8f4ff" }) {
  return (
    <div>
      <p style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 10,
        letterSpacing: 1.5,
        color: "#3a5570",
        margin: "0 0 3px",
        textTransform: "uppercase",
      }}>{label}</p>
      <p style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 16,
        color,
        margin: 0,
      }}>{value}</p>
    </div>
  );
}

function EmptyDay({ label }) {
  return (
    <div style={{
      background: "#0d1422",
      border: "1px dashed #1e2d42",
      borderRadius: 8,
      padding: "28px",
      textAlign: "center",
      color: "#3a5570",
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: 14,
      letterSpacing: 1,
    }}>{label}</div>
  );
}

function NavBtn({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "1px solid #2a4060",
        borderRadius: 6,
        color: "#7a9bbf",
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 1,
        padding: "6px 12px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#00c8ff";
        e.currentTarget.style.color = "#00c8ff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#2a4060";
        e.currentTarget.style.color = "#7a9bbf";
      }}
    >
      {label}
    </button>
  );
}
