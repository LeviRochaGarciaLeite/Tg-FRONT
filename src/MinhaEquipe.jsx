// MinhaEquipe.jsx
// Adicione no App.jsx: import MinhaEquipe from "./MinhaEquipe";
// E renderize quando abaAtiva === "equipe"

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

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
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
        {vazio ? "Aguardando" : perfil ? perfil : isSuper ? "Supervisor" : "Colaborador"}
      </div>
    </div>
  );
}

export default function MinhaEquipe({ userData }) {
  const [equipe, setEquipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Lista de colaboradores disponíveis (supervisor)
  const [disponiveis, setDisponiveis] = useState([]);
  const [loadingDisponiveis, setLoadingDisponiveis] = useState(false);
  const [adicionando, setAdicionando] = useState(null);
  const [removendo, setRemovendo] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");

  const isSupervisor = (userData?.perfil || "").toLowerCase() === "supervisor";

  // Limpar toast após 3s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function carregarEquipe() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/equipe/minha`, {
        headers: getAuthHeader(),
      });
      setEquipe(data);
    } catch (e) {
      if (e?.response?.status === 404) {
        setEquipe(null);
      } else {
        setErro("Erro ao carregar os dados da equipe.");
      }
    }
    setLoading(false);
  }

  // Carregar colaboradores disponíveis (supervisor)
  async function carregarDisponiveis() {
    setLoadingDisponiveis(true);
    try {
      const { data } = await axios.get(`${API_BASE}/equipe/disponiveis`, {
        headers: getAuthHeader(),
      });
      setDisponiveis(data.disponiveis || []);
    } catch {
      setDisponiveis([]);
    }
    setLoadingDisponiveis(false);
  }

  useEffect(() => {
    carregarEquipe();
  }, []);

  useEffect(() => {
    if (isSupervisor) carregarDisponiveis();
  }, [isSupervisor]);

  const supervisor = equipe?.supervisor || null;
  const colaboradores = equipe?.membros || [];
  const equipeCheia = colaboradores.length >= 2;

  // Adicionar membro à equipe
  async function adicionarMembro(colaboradorId) {
    if (equipeCheia) return;
    setAdicionando(colaboradorId);
    try {
      await axios.post(
        `${API_BASE}/equipe/adicionar`,
        { colaborador_id: colaboradorId },
        { headers: getAuthHeader() }
      );
      await carregarEquipe();
      await carregarDisponiveis();
    } catch {
      setErro("Erro ao adicionar colaborador.");
    }
    setAdicionando(null);
  }

  // Remover membro da equipe
  async function removerMembro(colaboradorId) {
    setRemovendo(colaboradorId);
    try {
      await axios.post(
        `${API_BASE}/equipe/remover`,
        { colaborador_id: colaboradorId },
        { headers: getAuthHeader() }
      );
      await carregarEquipe();
      await carregarDisponiveis();
    } catch {
      setErro("Erro ao remover colaborador.");
    }
    setRemovendo(null);
  }

  // Salvar equipe
  async function salvarEquipe() {
    setSalvando(true);
    try {
      const ids = (equipe?.membros || []).map((m) => m.id);
      await axios.post(
        `${API_BASE}/equipe/salvar`,
        { membros_ids: ids },
        { headers: getAuthHeader() }
      );
      setToast("Equipe salva com sucesso!");
    } catch {
      setErro("Erro ao salvar equipe.");
    }
    setSalvando(false);
  }

  return (
    <>
      {/* Keyframes injetados uma vez */}
      <style>{`
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
        {!loading && !erro && !equipe && !isSupervisor && (
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
        {!loading && !erro && (equipe || isSupervisor) && (
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
                marginTop: 28,
              }}
            >
              {colaboradores.length > 0
                ? colaboradores.map((colab, idx) => (
                    <div key={colab?.id || idx} style={{ position: "relative" }}>
                      <ProfileCard
                        nome={colab?.nome}
                        perfil="Colaborador"
                        foto={colab?.foto_perfil}
                        isSuper={false}
                        vazio={!colab}
                      />
                      {/* Pontuação */}
                      {colab && (
                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            justifyContent: "center",
                            gap: 12,
                            fontFamily: "var(--mono)",
                            fontSize: 11,
                            letterSpacing: 0.5,
                          }}
                        >
                          <span style={{ color: "rgba(0,200,120,0.85)" }}>
                            +{colab.pontos_positivos ?? 0}
                          </span>
                          <span style={{ color: "rgba(255,80,80,0.85)" }}>
                            −{colab.pontos_negativos ?? 0}
                          </span>
                          <span
                            style={{
                              color:
                                (colab.pontos_positivos ?? 0) - (colab.pontos_negativos ?? 0) >= 0
                                  ? "var(--accent-cyan)"
                                  : "rgba(255,80,80,0.85)",
                              fontWeight: 700,
                            }}
                          >
                            ={" "}
                            {(colab.pontos_positivos ?? 0) - (colab.pontos_negativos ?? 0)}
                          </span>
                        </div>
                      )}
                      {/* Botão remover (supervisor) */}
                      {isSupervisor && colab && (
                        <button
                          onClick={() => removerMembro(colab.id)}
                          disabled={removendo === colab.id}
                          style={{
                            position: "absolute",
                            top: 0,
                            right: -8,
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "rgba(255,60,60,0.85)",
                            color: "#fff",
                            border: "none",
                            cursor: removendo === colab.id ? "wait" : "pointer",
                            fontSize: 14,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 5,
                            opacity: removendo === colab.id ? 0.5 : 1,
                          }}
                          title="Remover da equipe"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))
                : [0, 1].map((idx) => (
                    <div key={idx}>
                      <ProfileCard
                        nome={null}
                        perfil="Colaborador"
                        foto={null}
                        isSuper={false}
                        vazio
                      />
                    </div>
                  ))}
            </div>

            {/* Lista de colaboradores disponíveis — somente supervisor */}
            {isSupervisor && (
              <div
                style={{
                  marginTop: 40,
                  width: "100%",
                  maxWidth: 420,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "24px 20px",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: 11,
                    letterSpacing: 2,
                    color: "var(--accent-gold)",
                    textTransform: "uppercase",
                    marginBottom: 14,
                    textAlign: "center",
                  }}
                >
                  Colaboradores Disponíveis {colaboradores.length}/2
                </p>

                {loadingDisponiveis && (
                  <p
                    style={{
                      color: "var(--accent-cyan)",
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    Carregando...
                  </p>
                )}

                {!loadingDisponiveis && disponiveis.length === 0 && (
                  <p
                    style={{
                      color: "var(--text-lo)",
                      fontFamily: "var(--sans)",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    Nenhum colaborador disponível no momento.
                  </p>
                )}

                {!loadingDisponiveis && disponiveis.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      maxHeight: 280,
                      overflowY: "auto",
                    }}
                  >
                    {disponiveis.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 8,
                          padding: "8px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <AvatarCircle
                            foto={r.foto_perfil}
                            nome={r.nome}
                            size={32}
                          />
                          <span
                            style={{
                              fontFamily: "var(--sans)",
                              fontSize: 13,
                              color: "var(--text-hi)",
                            }}
                          >
                            {r.nome}
                          </span>
                        </div>
                        <button
                          onClick={() => adicionarMembro(r.id)}
                          disabled={adicionando === r.id || equipeCheia}
                          style={{
                            background: equipeCheia ? "rgba(255,255,255,0.15)" : "rgba(0,200,120,0.8)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 5,
                            padding: "4px 12px",
                            fontFamily: "var(--display)",
                            fontSize: 10,
                            letterSpacing: 1,
                            cursor: adicionando === r.id || equipeCheia ? "not-allowed" : "pointer",
                            opacity: adicionando === r.id || equipeCheia ? 0.4 : 1,
                          }}
                          title={equipeCheia ? "Equipe já está completa (máx. 2)" : ""}
                        >
                          {adicionando === r.id ? "..." : equipeCheia ? "COMPLETA" : "ADICIONAR"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botão salvar equipe (supervisor) */}
            {isSupervisor && colaboradores.length > 0 && (
              <button
                onClick={salvarEquipe}
                disabled={salvando}
                style={{
                  marginTop: 32,
                  background: "linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 40px",
                  fontFamily: "var(--display)",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  cursor: salvando ? "wait" : "pointer",
                  opacity: salvando ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {salvando ? "SALVANDO..." : "SALVAR EQUIPE"}
              </button>
            )}
          </>
        )}

        {/* Toast de feedback */}
        {toast && (
          <div
            style={{
              position: "fixed",
              bottom: 32,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,200,120,0.92)",
              color: "#fff",
              fontFamily: "var(--sans)",
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 28px",
              borderRadius: 8,
              zIndex: 9999,
              animation: "eq-fade-in 0.3s ease",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
