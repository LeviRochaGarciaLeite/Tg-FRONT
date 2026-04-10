//telaequiep

import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function AvatarCircle({ foto, nome, size = 72, isSuper = false }) {
  const initials = nome
    ? nome
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "?";

  const ringColor = isSuper
    ? "rgba(255, 204, 0, 0.55)"
    : "rgba(0, 200, 255, 0.4)";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {/* Anel */}
      <svg
        style={{
          position: "absolute",
          top: -4,
          left: -4,
          width: size + 8,
          height: size + 8,
          pointerEvents: "none",
        }}
        viewBox="0 0 80 80"
        fill="none"
      >
        <circle
          cx="40"
          cy="40"
          r="37"
          stroke={ringColor}
          strokeWidth="1.5"
          strokeDasharray={isSuper ? "6 5" : "4 6"}
        />
      </svg>

      {/* Avatar */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: isSuper ? "#1e2a14" : "#182a3e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
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
              fontSize: size * 0.3,
              fontWeight: 700,
              color: isSuper ? "var(--accent-gold)" : "var(--accent-cyan)",
              userSelect: "none",
            }}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}

function ProfileCard({ nome, perfil, foto, isSuper = false, vazio = false }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        background: isSuper ? "#0f1a28" : "var(--bg-card)",
        border: `1px solid ${isSuper ? "rgba(255,204,0,0.3)" : "var(--border)"}`,
        borderRadius: 12,
        padding: "28px 32px 20px",
        position: "relative",
        minWidth: 160,
        transition: "border-color 0.25s",
        opacity: vazio ? 0.45 : 1,
      }}
    >
      {/* Badge */}
      <div
        style={{
          position: "absolute",
          top: -11,
          background: isSuper ? "var(--accent-gold)" : "var(--accent-blue)",
          color: isSuper ? "#1a1000" : "#fff",
          fontSize: 9,
          fontWeight: 700,
          padding: "2px 12px",
          borderRadius: 4,
          letterSpacing: 1,
          fontFamily: "var(--display)",
          textTransform: "uppercase",
        }}
      >
        {isSuper ? "Supervisor" : "Colaborador"}
      </div>

      <AvatarCircle foto={foto} nome={nome} isSuper={isSuper} />

      <div
        style={{
          fontFamily: "var(--sans)",
          fontSize: 14,
          fontWeight: 600,
          color: vazio ? "var(--text-lo)" : "var(--text-hi)",
          textAlign: "center",
          letterSpacing: 0.5,
          marginTop: 4,
        }}
      >
        {vazio ? "—" : nome || "—"}
      </div>

      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: isSuper ? "rgba(255,204,0,0.6)" : "var(--text-mid)",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {vazio ? "Aguardando" : perfil || isSuper ? "Supervisor" : "Colaborador"}
      </div>
    </div>
  );
}

export default function MinhaEquipe() {
  const [equipe, setEquipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarEquipe() {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE}/equipe/minha`, {
          headers: getAuthHeader(),
        });
        setEquipe(data); // Espera: { supervisor: {...}, colaboradores: [{...}, {...}] }
      } catch (e) {
        // Se ainda não tem equipe, mostra tela vazia sem erro
        if (e?.response?.status === 404) {
          setEquipe(null);
        } else {
          setErro("Erro ao carregar os dados da equipe.");
        }
      }
      setLoading(false);
    }

    carregarEquipe();
  }, []);

  const supervisor = equipe?.supervisor || null;
  const colaboradores = equipe?.colaboradores || [null, null];

  return (
    <>
      {/* Keyframes injetados uma vez */}
      <style>{`
        @keyframes eq-spin { to { transform: rotate(360deg); } }
        @keyframes eq-fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 24px 60px",
          minHeight: 480,
          animation: "eq-fade-in 0.4s ease",
        }}
      >
        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2
            style={{
              fontFamily: "var(--display)",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              color: "var(--text-hi)",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Minha Equipe
          </h2>
          <div
            style={{
              width: 80,
              height: 2,
              background:
                "linear-gradient(90deg, transparent, var(--accent-cyan), transparent)",
              margin: "10px auto 0",
            }}
          />
        </div>

        {/* Estado de loading */}
        {loading && (
          <p
            style={{
              color: "var(--accent-cyan)",
              fontFamily: "var(--mono)",
              fontSize: 13,
              letterSpacing: 1,
            }}
          >
            Carregando equipe...
          </p>
        )}

        {/* Erro */}
        {!loading && erro && (
          <p
            style={{
              color: "var(--accent-red)",
              fontFamily: "var(--sans)",
              fontSize: 14,
              opacity: 0.8,
            }}
          >
            {erro}
          </p>
        )}

        {/* Sem equipe ainda */}
        {!loading && !erro && !equipe && (
          <p
            style={{
              color: "var(--text-lo)",
              fontFamily: "var(--sans)",
              fontSize: 14,
              textAlign: "center",
              maxWidth: 320,
              lineHeight: 1.6,
            }}
          >
            Você ainda não foi adicionado a uma equipe. Aguarde seu supervisor.
          </p>
        )}

        {/* Conteúdo da equipe */}
        {!loading && !erro && (
          <>
            {/* Supervisor */}
            <div style={{ marginBottom: 12 }}>
              <p
                style={{
                  fontFamily: "var(--display)",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: "var(--accent-gold)",
                  textTransform: "uppercase",
                  textAlign: "center",
                  marginBottom: 12,
                  opacity: 0.85,
                }}
              >
                Supervisor
              </p>
              <ProfileCard
                nome={supervisor?.nome}
                perfil="Supervisor"
                foto={supervisor?.foto_perfil}
                isSuper
                vazio={!supervisor}
              />
            </div>

            {/* Colaboradores */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 32,
                flexWrap: "wrap",
                marginTop: 0,
              }}
            >
              {[0, 1].map((idx) => {
                const colab = colaboradores[idx] || null;
                return (
                  <div key={idx}>
                    <p
                      style={{
                        fontFamily: "var(--display)",
                        fontSize: 10,
                        letterSpacing: 2,
                        color: "var(--accent-blue)",
                        textTransform: "uppercase",
                        textAlign: "center",
                        marginBottom: 12,
                        opacity: 0.85,
                      }}
                    >
                      Colaborador
                    </p>
                    <ProfileCard
                      nome={colab?.nome}
                      perfil="Colaborador"
                      foto={colab?.foto_perfil}
                      isSuper={false}
                      vazio={!colab}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
