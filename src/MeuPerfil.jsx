// MeuPerfil.jsx
// Uso: <MeuPerfil userData={userData} onClose={() => setShowMeuPerfil(false)} />
//
// Integração no App.jsx:
//   1. import MeuPerfil from "./MeuPerfil";
//   2. const [showMeuPerfil, setShowMeuPerfil] = useState(false);
//   3. No dropdown do avatar adicione: onClick={() => setShowMeuPerfil(true)}
//   4. Renderize: {showMeuPerfil && <MeuPerfil userData={userData} onClose={() => setShowMeuPerfil(false)} />}

import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatarData(valor) {
  if (!valor) return null;
  // suporta "YYYY-MM-DD" e "DD/MM/YYYY"
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [y, m, d] = valor.split("-");
    return `${d}/${m}/${y}`;
  }
  return valor;
}

function formatarCpf(valor) {
  if (!valor) return null;
  const digits = String(valor).replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarCelular(valor) {
  if (!valor) return null;
  const digits = String(valor).replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return digits.replace(/(\d{2})(\d{1,5})/, "($1) $2");
  return digits.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
}

// ── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ foto, nome, size = 88 }) {
  const initials = nome
    ? nome
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: foto ? "transparent" : "linear-gradient(135deg, #178396, #22b1c8)",
        border: "2px solid var(--border-hi)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 0 0 4px rgba(0,200,255,0.08)",
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
            color: "#fff",
            letterSpacing: 1,
            userSelect: "none",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

// ── Linha de dado pessoal ────────────────────────────────────────────────────

function DadoItem({ label, valor }) {
  if (!valor) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "10px 0",
        borderBottom: "1px solid rgba(30,45,66,0.6)",
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
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 13,
          color: "var(--text-hi)",
          letterSpacing: 0.5,
        }}
      >
        {valor}
      </span>
    </div>
  );
}

// ── Card container ───────────────────────────────────────────────────────────

function Card({ title, children, style }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 24px",
        ...style,
      }}
    >
      {title && (
        <p
          style={{
            fontFamily: "var(--display)",
            fontSize: 10,
            letterSpacing: 3,
            color: "var(--text-lo)",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function MeuPerfil({ userData, onClose }) {
  const [equipeNome, setEquipeNome] = useState(null);
  const [totalPontos, setTotalPontos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const isSupervisor = (userData?.perfil || "").toLowerCase() === "supervisor";

  // Fechar com Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Buscar dados da equipe e pontos
  useEffect(() => {
    async function carregar() {
      setLoading(true);
      setErro("");
      try {
        const headers = getAuthHeader();

        // Equipe
        try {
          const { data: equipeData } = await axios.get(`${API_BASE}/equipe/minha`, { headers });
          // Tenta nome_equipe, nome, ou supervisor.equipe_nome dependendo do back-end
          const nome =
            equipeData?.nome_equipe ||
            equipeData?.nome ||
            equipeData?.supervisor?.equipe_nome ||
            null;
          setEquipeNome(nome);
        } catch {
          setEquipeNome(null);
        }

        // Pontos — tenta endpoint de ranking/pontos do usuário
        try {
          const { data: pontosData } = await axios.get(`${API_BASE}/pontos/meus`, { headers });
          const total =
            pontosData?.total_pontos ??
            pontosData?.total ??
            pontosData?.pontos ??
            null;
          setTotalPontos(total);
        } catch {
          // Fallback: busca ranking geral e filtra pelo usuário logado
          try {
            const { data: rankData } = await axios.get(`${API_BASE}/ranking`, { headers });
            const lista = rankData?.ranking || rankData?.usuarios || rankData || [];
            const meuNome = userData?.nome || "";
            const meuItem = Array.isArray(lista)
              ? lista.find(
                  (u) =>
                    u.nome === meuNome ||
                    u.id === rankData?.usuario_id
                )
              : null;
            const total =
              meuItem?.total_pontos ??
              meuItem?.pontos ??
              null;
            setTotalPontos(total);
          } catch {
            setTotalPontos(null);
          }
        }
      } catch {
        setErro("Não foi possível carregar todos os dados.");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [userData]);

  const nome = userData?.nome || "—";
  const foto = userData?.foto_perfil || "";
  const dataNascimento = formatarData(userData?.data_nascimento);
  const cidade = userData?.cidade
    ? `${userData.cidade}${userData?.estado ? `/${userData.estado}` : ""}`
    : null;
  const celular = formatarCelular(userData?.celular);
  const cpf = formatarCpf(userData?.cpf);

  const temDadosPessoais = dataNascimento || cidade || celular || cpf;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 9999, alignItems: "flex-start", paddingTop: 0, overflowY: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Painel lateral / card central */}
      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-hi)",
          borderRadius: 0,
          width: "100%",
          maxWidth: 420,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "0 0 32px",
          boxShadow: "4px 0 40px rgba(0,0,0,0.7)",
          marginLeft: 0,
          animation: "slideInLeft 0.22s ease",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Cabeçalho ── */}
        <div
          style={{
            background: "linear-gradient(135deg, #002d35 0%, #001a20 100%)",
            padding: "28px 24px 24px",
            borderBottom: "1px solid var(--border)",
            position: "relative",
          }}
        >
          {/* Botão fechar */}
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "transparent",
              border: "none",
              color: "var(--text-mid)",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-cyan)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-mid)")}
          >
            ✕
          </button>

          {/* Título da tela */}
          <p
            style={{
              fontFamily: "var(--display)",
              fontSize: 10,
              letterSpacing: 3,
              color: "var(--accent-cyan)",
              textTransform: "uppercase",
              marginBottom: 20,
              opacity: 0.8,
            }}
          >
            Meu Perfil
          </p>

          {/* Avatar + Info */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Avatar foto={foto} nome={nome} size={72} />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Nome */}
              <h2
                style={{
                  fontFamily: "var(--display)",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--text-hi)",
                  letterSpacing: 0.5,
                  margin: 0,
                  lineHeight: 1.2,
                  wordBreak: "break-word",
                }}
              >
                {nome}
              </h2>

              {/* Badge Supervisor */}
              {isSupervisor && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(255,204,0,0.12)",
                    border: "1px solid rgba(255,204,0,0.35)",
                    borderRadius: 5,
                    padding: "2px 10px",
                    marginTop: 7,
                  }}
                >
                  <span style={{ color: "var(--accent-gold)", fontSize: 9 }}>★</span>
                  <span
                    style={{
                      fontFamily: "var(--display)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      color: "var(--accent-gold)",
                      textTransform: "uppercase",
                    }}
                  >
                    Supervisor
                  </span>
                </div>
              )}

              {/* Equipe */}
              {equipeNome && (
                <p
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 11,
                    color: "var(--text-mid)",
                    marginTop: isSupervisor ? 5 : 7,
                    letterSpacing: 0.3,
                  }}
                >
                  {equipeNome}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>

          {/* Loading global */}
          {loading && (
            <p
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--accent-cyan)",
                letterSpacing: 1,
                textAlign: "center",
                padding: "20px 0",
                opacity: 0.7,
              }}
            >
              Carregando...
            </p>
          )}

          {/* Erro não-crítico */}
          {!loading && erro && (
            <p
              style={{
                fontFamily: "var(--sans)",
                fontSize: 12,
                color: "var(--accent-red)",
                opacity: 0.75,
                textAlign: "center",
              }}
            >
              {erro}
            </p>
          )}

          {/* ── Card Total de Pontos ── */}
          {!loading && (
            <Card>
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <p
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: 10,
                    letterSpacing: 3,
                    color: "var(--text-lo)",
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  Total de Pontos
                </p>

                {totalPontos !== null ? (
                  <span
                    style={{
                      fontFamily: "var(--display)",
                      fontSize: 42,
                      fontWeight: 700,
                      color: "var(--accent-cyan)",
                      letterSpacing: 2,
                      lineHeight: 1,
                      textShadow: "0 0 20px rgba(0,200,255,0.35)",
                    }}
                  >
                    {Number(totalPontos).toLocaleString("pt-BR")}
                  </span>
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 14,
                      color: "var(--text-lo)",
                      letterSpacing: 1,
                    }}
                  >
                    —
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* ── Card Dados Pessoais ── */}
          {!loading && temDadosPessoais && (
            <Card title="Dados Pessoais">
              <DadoItem label="Data de Nascimento" valor={dataNascimento} />
              <DadoItem label="Cidade" valor={cidade} />
              <DadoItem label="Celular" valor={celular} />
              <DadoItem label="CPF" valor={cpf} />
            </Card>
          )}

          {/* Caso não haja dados pessoais preenchidos */}
          {!loading && !temDadosPessoais && (
            <Card title="Dados Pessoais">
              <p
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 12,
                  color: "var(--text-lo)",
                  textAlign: "center",
                  padding: "8px 0",
                }}
              >
                Nenhum dado pessoal cadastrado.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Animação de entrada lateral */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        @media (min-width: 480px) {
          /* Em telas maiores, centraliza como modal */
          .meu-perfil-panel {
            border-radius: 16px !important;
            min-height: auto !important;
            margin: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
