// Ranking.jsx
// Adicione no App.jsx: import Ranking from "./Ranking";
// E renderize quando abaAtiva === "ranking"

import { useEffect, useState, useRef } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ── Utilitários ──────────────────────────────────────────────────────── */

function calcPontos(u) {
  return (u.pontos_positivos ?? 0) - (u.pontos_negativos ?? 0);
}

function getInitials(nome) {
  if (!nome) return "?";
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function hasRankingPoints(usuario) {
  return calcPontos(usuario) !== 0;
}

/* ── Avatar ──────────────────────────────────────────────────────────── */

function Avatar({ foto, nome, size = 64, glow = false, isSuper = false }) {
  const color = isSuper ? "var(--accent-gold)" : "var(--accent-cyan)";
  const bg = isSuper ? "#1e2a14" : "#0d1e30";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        border: `2px solid ${color}`,
        boxShadow: glow ? `0 0 18px ${color}55, 0 0 40px ${color}22` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
        transition: "box-shadow 0.3s",
      }}
    >
      {foto ? (
        <img
          src={foto}
          alt={nome}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            fontFamily: "var(--display)",
            fontSize: size * 0.32,
            fontWeight: 700,
            color,
            userSelect: "none",
          }}
        >
          {getInitials(nome)}
        </span>
      )}
    </div>
  );
}

/* ── Medalha do top 1 ────────────────────────────────────────────────── */

function MedalBadge({ rank }) {
  const medals = {
    1: { emoji: "🥇", color: "#ffcc00", glow: "rgba(255,204,0,0.6)" },
    2: { emoji: "🥈", color: "#b0c4de", glow: "rgba(176,196,222,0.4)" },
    3: { emoji: "🥉", color: "#cd7f32", glow: "rgba(205,127,50,0.4)" },
  };
  const m = medals[rank];
  if (!m) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: -14,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: rank === 1 ? 22 : 17,
        filter: `drop-shadow(0 0 6px ${m.glow})`,
        zIndex: 5,
        animation: rank === 1 ? "rankFloat 3s ease-in-out infinite" : "none",
      }}
    >
      {m.emoji}
    </div>
  );
}

/* ── Card de Funcionário ─────────────────────────────────────────────── */

function FuncCard({ usuario, rank, animDelay = 0 }) {
  const pontos = calcPontos(usuario);
  const isFirst = rank === 1;

  const borderColor = isFirst
    ? "rgba(255,204,0,0.5)"
    : rank === 2
    ? "rgba(176,196,222,0.3)"
    : "rgba(205,127,50,0.25)";

  const bgGrad = isFirst
    ? "linear-gradient(145deg, #13200c 0%, #0f1720 100%)"
    : "linear-gradient(145deg, #0f1720 0%, #0d1422 100%)";

  return (
    <div
      className="rank-card"
      style={{
        position: "relative",
        background: bgGrad,
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: isFirst ? "36px 24px 24px" : "32px 20px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        flex: "1 1 0",
        minWidth: 150,
        maxWidth: 220,
        boxShadow: isFirst
          ? "0 0 30px rgba(255,204,0,0.08), 0 8px 32px rgba(0,0,0,0.4)"
          : "0 4px 20px rgba(0,0,0,0.3)",
        animation: `rankSlideIn 0.5s ease ${animDelay}s both`,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = isFirst
          ? "0 0 40px rgba(255,204,0,0.14), 0 12px 40px rgba(0,0,0,0.5)"
          : "0 8px 32px rgba(0,0,0,0.45)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = isFirst
          ? "0 0 30px rgba(255,204,0,0.08), 0 8px 32px rgba(0,0,0,0.4)"
          : "0 4px 20px rgba(0,0,0,0.3)";
      }}
    >
      <MedalBadge rank={rank} />

      {/* Rank number */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 14,
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--text-lo)",
          letterSpacing: 1,
        }}
      >
        #{rank}
      </div>

      <Avatar
        foto={usuario.foto_perfil}
        nome={usuario.nome}
        size={isFirst ? 76 : 64}
        glow={isFirst}
      />

      <div
        style={{
          fontFamily: "var(--sans)",
          fontSize: isFirst ? 15 : 13,
          fontWeight: 700,
          color: "var(--text-hi)",
          textAlign: "center",
          letterSpacing: 0.3,
          lineHeight: 1.3,
          maxWidth: 160,
          wordBreak: "break-word",
        }}
      >
        {usuario.nome}
      </div>

      {/* Pontuação */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          marginTop: 4,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: isFirst ? 22 : 18,
            fontWeight: 700,
            color: pontos >= 0 ? "var(--accent-cyan)" : "var(--accent-red)",
            letterSpacing: 1,
            textShadow: pontos >= 0
              ? "0 0 12px rgba(0,200,255,0.5)"
              : "0 0 12px rgba(255,59,85,0.5)",
          }}
        >
          {pontos >= 0 ? "+" : ""}{pontos}
        </span>
        <span
          style={{
            fontFamily: "var(--display)",
            fontSize: 9,
            letterSpacing: 2,
            color: "var(--text-lo)",
            textTransform: "uppercase",
          }}
        >
          pontos
        </span>
      </div>

      {/* Sub breakdown */}
      <div
        style={{
          display: "flex",
          gap: 10,
          fontFamily: "var(--mono)",
          fontSize: 10,
          marginTop: 2,
        }}
      >
        <span style={{ color: "rgba(0,232,122,0.8)" }}>
          +{usuario.pontos_positivos ?? 0}
        </span>
        <span style={{ color: "rgba(255,59,85,0.7)" }}>
          −{usuario.pontos_negativos ?? 0}
        </span>
      </div>
    </div>
  );
}

/* ── Card de Membro de Equipe ────────────────────────────────────────── */

function TeamMemberCard({ usuario, isSuper = false, animDelay = 0 }) {
  const pontos = calcPontos(usuario);
  const accentColor = isSuper ? "var(--accent-gold)" : "var(--accent-cyan)";
  const bg = isSuper
    ? "linear-gradient(145deg, #1a2210 0%, #0f1720 100%)"
    : "linear-gradient(145deg, #0d1e30 0%, #0d1422 100%)";

  return (
    <div
      className="rank-card"
      style={{
        position: "relative",
        background: bg,
        border: `1px solid ${isSuper ? "rgba(255,204,0,0.35)" : "var(--border)"}`,
        borderRadius: 12,
        padding: "28px 20px 18px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flex: "1 1 0",
        minWidth: 200,
        boxShadow: isSuper
          ? "0 0 20px rgba(255,204,0,0.06), 0 4px 20px rgba(0,0,0,0.3)"
          : "0 4px 16px rgba(0,0,0,0.25)",
        animation: `rankSlideIn 0.5s ease ${animDelay}s both`,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Role badge */}
      <div
        style={{
          position: "absolute",
          top: -11,
          left: "50%",
          transform: "translateX(-50%)",
          background: isSuper ? "var(--accent-gold)" : "var(--accent-blue)",
          color: isSuper ? "#1a1000" : "#fff",
          fontSize: 9,
          fontWeight: 700,
          padding: "2px 14px",
          borderRadius: 4,
          letterSpacing: 1.5,
          fontFamily: "var(--display)",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {isSuper ? "Supervisor" : "Colaborador"}
      </div>

      <Avatar
        foto={usuario.foto_perfil}
        nome={usuario.nome}
        size={56}
        glow={isSuper}
        isSuper={isSuper}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--sans)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-hi)",
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {usuario.nome}
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: isSuper ? "rgba(255,204,0,0.6)" : "var(--text-mid)",
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {usuario.perfil}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 16,
              fontWeight: 700,
              color: pontos >= 0 ? accentColor : "var(--accent-red)",
              textShadow: `0 0 10px ${pontos >= 0 ? (isSuper ? "rgba(255,204,0,0.5)" : "rgba(0,200,255,0.5)") : "rgba(255,59,85,0.5)"}`,
            }}
          >
            {pontos >= 0 ? "+" : ""}{pontos}
          </span>
          <span
            style={{
              fontFamily: "var(--display)",
              fontSize: 9,
              letterSpacing: 2,
              color: "var(--text-lo)",
              textTransform: "uppercase",
            }}
          >
            pts
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(0,232,122,0.7)", marginLeft: 4 }}>
            +{usuario.pontos_positivos ?? 0}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "rgba(255,59,85,0.7)" }}>
            −{usuario.pontos_negativos ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Section Header ──────────────────────────────────────────────────── */

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h2
          style={{
            fontFamily: "var(--display)",
            fontSize: "clamp(16px, 2.5vw, 20px)",
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "var(--text-hi)",
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      {subtitle && (
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-lo)",
            letterSpacing: 1,
            margin: 0,
            paddingLeft: 28,
          }}
        >
          {subtitle}
        </p>
      )}
      <div
        style={{
          height: 1,
          background: "linear-gradient(90deg, var(--accent-cyan) 0%, transparent 60%)",
          marginTop: 10,
          opacity: 0.3,
        }}
      />
    </div>
  );
}

/* ── Skeleton loader ─────────────────────────────────────────────────── */

function SkeletonCard({ wide = false }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: wide ? 12 : 14,
        padding: wide ? "28px 20px 18px" : "32px 20px 20px",
        flex: "1 1 0",
        minWidth: wide ? 200 : 150,
        maxWidth: wide ? "none" : 220,
        display: "flex",
        flexDirection: wide ? "row" : "column",
        alignItems: "center",
        gap: wide ? 16 : 10,
        animation: "skelPulse 1.4s ease-in-out infinite",
      }}
    >
      <div
        style={{
          width: wide ? 56 : 64,
          height: wide ? 56 : 64,
          borderRadius: "50%",
          background: "var(--border)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, alignItems: wide ? "flex-start" : "center" }}>
        <div style={{ width: wide ? 120 : 80, height: 10, borderRadius: 4, background: "var(--border)" }} />
        <div style={{ width: wide ? 80 : 50, height: 18, borderRadius: 4, background: "var(--border-hi)" }} />
      </div>
    </div>
  );
}

/* ── Ranking principal ───────────────────────────────────────────────── */

export default function Ranking() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [equipe, setEquipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function carregarRanking() {
    setLoading(true);
    setErro("");
    try {
      const [resFunc, resEquipe] = await Promise.all([
        axios.get(`${API_BASE}/ranking/funcionarios`, { headers: getAuthHeader() }),
        axios.get(`${API_BASE}/ranking/melhor-equipe`, { headers: getAuthHeader() }),
      ]);
      setFuncionarios(resFunc.data.ranking || []);
      setEquipe(resEquipe.data || null);
      setLastUpdated(new Date());
    } catch (e) {
      setErro("Erro ao carregar dados de ranking.");
    }
    setLoading(false);
  }

  useEffect(() => {
    carregarRanking();
  }, []);

  const topFuncionarios = [...funcionarios]
    .filter(hasRankingPoints)
    .sort((a, b) => calcPontos(b) - calcPontos(a))
    .slice(0, 3);

  // Monta membros da equipe: supervisor + 2 membros
  const equipeMembros = equipe
    ? [
        ...(equipe.supervisor ? [{ ...equipe.supervisor, _isSuper: true }] : []),
        ...(equipe.membros || []).map((m) => ({ ...m, _isSuper: false })),
      ].filter(hasRankingPoints)
    : [];

  return (
    <>
      {/* Keyframes injetados via style tag */}
      <style>{`
        @keyframes rankSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rankFloat {
          0%, 100% { transform: translateY(0) translateX(-50%); }
          50% { transform: translateY(-4px) translateX(-50%); }
        }
        @keyframes skelPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes rankFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .rank-card { cursor: default; }
      `}</style>

      <main
        style={{
          padding: "28px clamp(12px, 3vw, 40px)",
          maxWidth: 900,
          margin: "0 auto",
          animation: "rankFadeIn 0.4s ease",
        }}
      >
        {/* Header da página */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 36,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--display)",
                fontSize: "clamp(20px, 4vw, 28px)",
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "var(--text-hi)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              🏆 Ranking
            </h1>
            {lastUpdated && (
              <p
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--text-lo)",
                  letterSpacing: 1,
                  margin: "4px 0 0",
                }}
              >
                Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          <button
            onClick={carregarRanking}
            disabled={loading}
            style={{
              background: "transparent",
              border: "1px solid var(--border-hi)",
              borderRadius: 8,
              color: loading ? "var(--text-lo)" : "var(--accent-cyan)",
              fontFamily: "var(--display)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "8px 18px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "border-color 0.2s, color 0.2s",
            }}
          >
            <span
              style={{
                display: "inline-block",
                animation: loading ? "spin 0.8s linear infinite" : "none",
              }}
            >
              ↻
            </span>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {/* Erro global */}
        {erro && (
          <div
            style={{
              background: "rgba(255,59,85,0.08)",
              border: "1px solid rgba(255,59,85,0.3)",
              color: "#ff8095",
              borderRadius: 10,
              padding: "14px 18px",
              fontFamily: "var(--sans)",
              fontSize: 13,
              marginBottom: 32,
              textAlign: "center",
            }}
          >
            {erro}
          </div>
        )}

        {/* ── Seção 1: Melhores Funcionários ── */}
        <section style={{ marginBottom: 48 }}>
          <SectionHeader
            icon="⭐"
            title="Melhores Funcionários"
            subtitle={`Top ${topFuncionarios.length > 0 ? Math.min(topFuncionarios.length, 3) : 3} colaboradores por pontuação`}
          />

          {loading ? (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : topFuncionarios.length === 0 ? (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "32px 24px",
                textAlign: "center",
                color: "var(--text-lo)",
                fontFamily: "var(--mono)",
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              Esperando....
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                justifyContent: topFuncionarios.length < 3 ? "flex-start" : "center",
                alignItems: "flex-end",
              }}
            >
              {topFuncionarios.map((u, idx) => (
                <FuncCard
                  key={u.id}
                  usuario={u}
                  rank={idx + 1}
                  animDelay={idx * 0.1}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Seção 2: Melhor Equipe ── */}
        <section>
          <SectionHeader
            icon="👥"
            title="Melhor Equipe"
            subtitle={equipe?.nome ? `Equipe: ${equipe.nome}` : "Supervisor + 2 colaboradores"}
          />

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1, 2].map((i) => <SkeletonCard key={i} wide />)}
            </div>
          ) : !equipe || equipeMembros.length === 0 ? (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "32px 24px",
                textAlign: "center",
                color: "var(--text-lo)",
                fontFamily: "var(--mono)",
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              Esperando....
            </div>
          ) : (
            <>
              {/* Pontuação total da equipe */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                  animation: "rankSlideIn 0.4s ease",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: 10,
                    letterSpacing: 2,
                    color: "var(--text-lo)",
                    textTransform: "uppercase",
                  }}
                >
                  Pontuação total da equipe:
                </span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--accent-cyan)",
                    textShadow: "0 0 10px rgba(0,200,255,0.4)",
                    letterSpacing: 1,
                  }}
                >
                  {equipeMembros.reduce((acc, m) => acc + calcPontos(m), 0) >= 0 ? "+" : ""}
                  {equipeMembros.reduce((acc, m) => acc + calcPontos(m), 0)}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {equipeMembros.map((m, idx) => (
                  <TeamMemberCard
                    key={m.id}
                    usuario={m}
                    isSuper={m._isSuper}
                    animDelay={idx * 0.1}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
