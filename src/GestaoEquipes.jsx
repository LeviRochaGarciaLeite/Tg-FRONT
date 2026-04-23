import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getToken() {
  return localStorage.getItem("nexus_token") || "";
}

function fmtSec(totalSec) {
  const safe = Math.max(0, Math.floor(Number(totalSec || 0)));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function fmtHM(value) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function calcPontos(usuario) {
  return (usuario?.pontos_positivos ?? 0) - (usuario?.pontos_negativos ?? 0);
}

function calcEstado(historico) {
  const hoje = new Date().toDateString();
  const registros = (historico || [])
    .filter((item) => item.status !== "recusado")
    .filter((item) => new Date(item.horario).toDateString() === hoje)
    .sort((a, b) => new Date(a.horario) - new Date(b.horario));

  if (registros.length === 0) {
    return { estado: "idle", inicioTs: null, saidaTs: null, pausaSeg: 0 };
  }

  const ultimoTipo = registros[registros.length - 1].tipo;
  const estadoMap = {
    entrada: "working",
    pausa_inicio: "paused",
    pausa_fim: "working",
    saida: "done",
  };
  const entrada = registros.find((item) => item.tipo === "entrada");
  const saida = [...registros].reverse().find((item) => item.tipo === "saida");

  let pausaSeg = 0;
  let pausaInicio = null;

  for (const registro of registros) {
    if (registro.tipo === "pausa_inicio") {
      pausaInicio = +new Date(registro.horario);
    }

    if (registro.tipo === "pausa_fim" && pausaInicio) {
      pausaSeg += Math.floor((+new Date(registro.horario) - pausaInicio) / 1000);
      pausaInicio = null;
    }
  }

  const estado = estadoMap[ultimoTipo] || "idle";
  if (estado === "paused" && pausaInicio) {
    pausaSeg += Math.floor((Date.now() - pausaInicio) / 1000);
  }

  return {
    estado,
    inicioTs: entrada ? +new Date(entrada.horario) : null,
    saidaTs: saida ? +new Date(saida.horario) : null,
    pausaSeg,
    inicio: entrada?.horario,
    fim: saida?.horario,
  };
}

const STATUS = {
  working: { label: "Trabalhando", color: "#00e87a" },
  paused: { label: "Em pausa", color: "#ffcc00" },
  done: { label: "Encerrado", color: "#7a9bbf" },
  idle: { label: "Nao iniciou", color: "#3a5570" },
};

function initials(nome) {
  if (!nome) return "?";
  return nome
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

function normalizeUsuario(usuario, rankingMap) {
  if (!usuario) return null;
  return {
    ...usuario,
    ...(rankingMap.get(usuario.id) || {}),
  };
}

function normalizeEquipe(raw, index, rankingMap) {
  const supervisor = normalizeUsuario(raw.supervisor || raw.lider || raw.gestor, rankingMap);
  const membrosRaw = raw.membros || raw.colaboradores || raw.integrantes || [];
  const membros = membrosRaw.map((item) => normalizeUsuario(item, rankingMap)).filter(Boolean);
  const todos = [supervisor, ...membros].filter(Boolean);

  return {
    id: raw.id ?? raw.equipe_id ?? supervisor?.id ?? `equipe-${index}`,
    nome: raw.nome || raw.nome_equipe || raw.equipe_nome || (supervisor ? `Equipe de ${supervisor.nome?.split(" ")[0]}` : "Equipe"),
    supervisor,
    membros,
    pontos: raw.pontos_total ?? raw.total_pontos ?? todos.reduce((acc, item) => acc + calcPontos(item), 0),
  };
}

function buildFallbackTeams(membros, rankingMap) {
  const usuarios = membros.map((item) => normalizeUsuario(item, rankingMap)).filter(Boolean);
  const grupos = new Map();

  usuarios.forEach((usuario) => {
    const key = usuario.equipe_id || usuario.id_equipe || usuario.nome_equipe || usuario.equipe_nome;
    if (!key) return;
    if (!grupos.has(key)) {
      grupos.set(key, {
        id: key,
        nome: usuario.nome_equipe || usuario.equipe_nome || `Equipe ${key}`,
        supervisor: null,
        membros: [],
      });
    }

    const grupo = grupos.get(key);
    if ((usuario.perfil || "").toLowerCase() === "supervisor") {
      grupo.supervisor = usuario;
    } else {
      grupo.membros.push(usuario);
    }
  });

  if (grupos.size > 0) {
    return [...grupos.values()].map((grupo) => ({
      ...grupo,
      pontos: [grupo.supervisor, ...grupo.membros].filter(Boolean).reduce((acc, item) => acc + calcPontos(item), 0),
    }));
  }

  return [
    {
      id: "geral",
      nome: "Equipe Geral",
      supervisor: usuarios.find((item) => (item.perfil || "").toLowerCase() === "supervisor") || null,
      membros: usuarios.filter((item) => (item.perfil || "").toLowerCase() !== "supervisor"),
      pontos: usuarios.reduce((acc, item) => acc + calcPontos(item), 0),
    },
  ];
}

function statusFromUsuario(usuario) {
  return {
    estado: usuario.status_jornada || "idle",
    inicioTs: usuario.inicio ? +new Date(usuario.inicio) : null,
    saidaTs: usuario.fim ? +new Date(usuario.fim) : null,
    pausaSeg: usuario.pausa_seg || 0,
    inicio: usuario.inicio || null,
    fim: usuario.fim || null,
  };
}

function StatusBadge({ estado }) {
  const status = STATUS[estado] || STATUS.idle;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 9px",
        borderRadius: 999,
        border: `1px solid ${status.color}55`,
        background: `${status.color}14`,
        color: status.color,
        fontFamily: "var(--display)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: status.color,
          boxShadow: estado === "working" ? `0 0 8px ${status.color}` : "none",
          animation: estado === "working" ? "gestaoLivePulse 1.4s ease infinite" : "none",
        }}
      />
      {status.label}
    </span>
  );
}

function Avatar({ usuario, size = 42 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #1e2d42, #111927)",
        border: "1px solid var(--border-hi)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        color: "var(--accent-cyan)",
        fontFamily: "var(--display)",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {usuario?.foto_perfil ? (
        <img
          src={usuario.foto_perfil}
          alt={usuario.nome}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials(usuario?.nome)
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        minWidth: 118,
        padding: "12px 14px",
        borderRadius: 12,
        background: `${color}12`,
        border: `1px solid ${color}30`,
      }}
    >
      <div style={{ color, fontFamily: "var(--mono)", fontSize: 24, fontWeight: 700 }}>
        {value}
      </div>
      <div
        style={{
          color: "var(--text-lo)",
          fontFamily: "var(--display)",
          fontSize: 10,
          letterSpacing: 1.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ColaboradorRow({ usuario, statusInfo, now }) {
  const status = STATUS[statusInfo?.estado] || STATUS.idle;
  const fimTs = statusInfo?.saidaTs || now;
  const jornada = statusInfo?.inicioTs ? Math.floor((fimTs - statusInfo.inicioTs) / 1000) : 0;
  const pontos = calcPontos(usuario);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 1fr) auto auto auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${status.color}`,
        background: "rgba(255,255,255,0.018)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar usuario={usuario} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "var(--text-hi)",
              fontFamily: "var(--sans)",
              fontWeight: 700,
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {usuario.nome}
          </div>
          <div
            style={{
              color: "var(--text-lo)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              textTransform: "uppercase",
            }}
          >
            {usuario.perfil || "colaborador"}
          </div>
        </div>
      </div>
      <StatusBadge estado={statusInfo?.estado} />
      <div style={{ color: status.color, fontFamily: "var(--mono)", fontSize: 12 }}>
        {jornada > 0 ? fmtSec(jornada) : "--:--:--"}
      </div>
      <div
        style={{
          color: pontos >= 0 ? "var(--accent-cyan)" : "var(--accent-red)",
          fontFamily: "var(--mono)",
          fontWeight: 700,
          textAlign: "right",
        }}
      >
        {pontos >= 0 ? "+" : ""}
        {pontos}
      </div>
    </div>
  );
}

function TeamMember({ usuario, statusInfo, isSupervisor }) {
  const pontos = calcPontos(usuario);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px",
        borderRadius: 10,
        background: isSupervisor ? "rgba(255,204,0,0.08)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isSupervisor ? "rgba(255,204,0,0.25)" : "var(--border)"}`,
      }}
    >
      <Avatar usuario={usuario} size={38} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            color: "var(--text-hi)",
            fontFamily: "var(--sans)",
            fontSize: 13,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {usuario.nome}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
          <StatusBadge estado={statusInfo?.estado} />
          <span style={{ color: isSupervisor ? "var(--accent-gold)" : "var(--text-mid)", fontFamily: "var(--mono)", fontSize: 10 }}>
            {isSupervisor ? "supervisor" : "colaborador"}
          </span>
        </div>
      </div>
      <div
        style={{
          color: pontos >= 0 ? "var(--accent-cyan)" : "var(--accent-red)",
          fontFamily: "var(--mono)",
          fontWeight: 700,
        }}
      >
        {pontos >= 0 ? "+" : ""}
        {pontos}
      </div>
    </div>
  );
}

function TeamCard({ equipe, statusMap }) {
  const membros = [equipe.supervisor, ...equipe.membros].filter(Boolean);
  const trabalhando = membros.filter((item) => statusMap[item.id]?.estado === "working").length;
  const pausados = membros.filter((item) => statusMap[item.id]?.estado === "paused").length;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-card2)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: "var(--text-hi)",
              fontFamily: "var(--display)",
              fontSize: 16,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            {equipe.nome}
          </h3>
          <p style={{ margin: "3px 0 0", color: "var(--text-lo)", fontFamily: "var(--mono)", fontSize: 10 }}>
            {membros.length} integrante{membros.length === 1 ? "" : "s"} · {trabalhando} trabalhando · {pausados} em pausa
          </p>
        </div>
        <div
          style={{
            color: equipe.pontos >= 0 ? "var(--accent-cyan)" : "var(--accent-red)",
            fontFamily: "var(--mono)",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {equipe.pontos >= 0 ? "+" : ""}
          {equipe.pontos}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
        {equipe.supervisor && (
          <TeamMember usuario={equipe.supervisor} statusInfo={statusMap[equipe.supervisor.id]} isSupervisor />
        )}
        {equipe.membros.map((membro) => (
          <TeamMember key={membro.id} usuario={membro} statusInfo={statusMap[membro.id]} />
        ))}
        {membros.length === 0 && (
          <div style={{ color: "var(--text-lo)", fontFamily: "var(--sans)", fontSize: 13, padding: 10 }}>
            Nenhum integrante encontrado nesta equipe.
          </div>
        )}
      </div>
    </section>
  );
}

export default function GestaoEquipes({ userData }) {
  const [membros, setMembros] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tick, setTick] = useState(Date.now());
  const streamRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const perfilLower = (userData?.perfil || "").toLowerCase();
  const isManager = ["gestor", "admin"].includes(perfilLower);

  const fetchRankingMap = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/ranking/funcionarios`, {
        headers: getAuthHeader(),
      });
      return new Map((data.ranking || []).map((item) => [item.id, item]));
    } catch {
      return new Map();
    }
  }, []);

  const fetchEquipes = useCallback(async (rankingMap, equipeMembros) => {
    const endpoints = ["/gestor/equipes", "/equipes"];

    for (const endpoint of endpoints) {
      try {
        const { data } = await axios.get(`${API_BASE}${endpoint}`, {
          headers: getAuthHeader(),
        });
        const lista = data.equipes || data.teams || (Array.isArray(data) ? data : []);
        if (lista.length > 0) {
          return lista.map((item, index) => normalizeEquipe(item, index, rankingMap));
        }
      } catch {
        // Alguns backends ainda nao tem endpoint de todas as equipes.
      }
    }

    return buildFallbackTeams(equipeMembros, rankingMap);
  }, []);

  const fetchStatus = useCallback(async (id) => {
    try {
      const { data } = await axios.get(`${API_BASE}/gestor/colaborador/${id}/historico`, {
        headers: getAuthHeader(),
      });
      return calcEstado(data.historico || []);
    } catch {
      return { estado: "idle", inicioTs: null, saidaTs: null, pausaSeg: 0 };
    }
  }, []);

  const carregarTudo = useCallback(async () => {
    if (!isManager) return;

    try {
      try {
        const { data } = await axios.get(`${API_BASE}/gestor/equipes/status`, {
          headers: getAuthHeader(),
        });
        const rankingMap = new Map();
        const colaboradores = data.colaboradores || [];

        setMembros(colaboradores.map((item) => normalizeUsuario(item, rankingMap)).filter(Boolean));
        setEquipes((data.equipes || []).map((item, index) => normalizeEquipe(item, index, rankingMap)));
        setStatusMap(Object.fromEntries(colaboradores.map((item) => [item.id, statusFromUsuario(item)])));
        setLastUpdate(data.atualizado_em ? new Date(data.atualizado_em) : new Date());
        setErro("");
        return;
      } catch {
        // Fallback para backends antigos enquanto a nova rota nao estiver rodando.
      }

      const rankingMap = await fetchRankingMap();
      const { data } = await axios.get(`${API_BASE}/gestor/equipe`, {
        headers: getAuthHeader(),
      });
      const equipeMembros = (data.equipe || []).map((item) => normalizeUsuario(item, rankingMap)).filter(Boolean);

      const [equipesAtuais, statusEntries] = await Promise.all([
        fetchEquipes(rankingMap, equipeMembros),
        Promise.all(equipeMembros.map(async (membro) => [membro.id, await fetchStatus(membro.id)])),
      ]);

      setMembros(equipeMembros);
      setEquipes(equipesAtuais);
      setStatusMap(Object.fromEntries(statusEntries));
      setLastUpdate(new Date());
      setErro("");
    } catch {
      setErro("Nao foi possivel carregar a gestao de equipes agora.");
    } finally {
      setLoading(false);
    }
  }, [fetchEquipes, fetchRankingMap, fetchStatus, isManager]);

  useEffect(() => {
    if (!isManager) return;
    carregarTudo();
    const interval = setInterval(carregarTudo, 15000);
    return () => clearInterval(interval);
  }, [carregarTudo, isManager]);

  useEffect(() => {
    if (!isManager) return;

    function refreshRealtime() {
      carregarTudo();
      setTimeout(carregarTudo, 700);
    }

    function connect() {
      const token = getToken();
      if (!token) return;

      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }

      const streamUrl = `${API_BASE}/gestor/equipes/stream?token=${encodeURIComponent(token)}`;
      const stream = new EventSource(streamUrl);
      streamRef.current = stream;

      stream.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tipo === "__connected__") return;
          if (data.tipo === "ponto_atualizado") refreshRealtime();
        } catch {
          // Ignora eventos malformados sem derrubar o painel.
        }
      };

      stream.onerror = () => {
        stream.close();
        streamRef.current = null;
        reconnectTimerRef.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [carregarTudo, isManager]);

  useEffect(() => {
    if (!isManager) return;
    function handlePontoAtualizado() {
      carregarTudo();
      setTimeout(carregarTudo, 900);
    }
    window.addEventListener("nexus:ponto-atualizado", handlePontoAtualizado);
    return () => window.removeEventListener("nexus:ponto-atualizado", handlePontoAtualizado);
  }, [carregarTudo, isManager]);

  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const resumo = useMemo(() => {
    return membros.reduce(
      (acc, membro) => {
        const estado = statusMap[membro.id]?.estado || "idle";
        acc[estado] += 1;
        return acc;
      },
      { working: 0, paused: 0, done: 0, idle: 0 }
    );
  }, [membros, statusMap]);

  const membrosOrdenados = useMemo(() => {
    const ordem = { working: 0, paused: 1, idle: 2, done: 3 };
    return [...membros].sort((a, b) => {
      const estadoA = statusMap[a.id]?.estado || "idle";
      const estadoB = statusMap[b.id]?.estado || "idle";
      return ordem[estadoA] - ordem[estadoB] || calcPontos(b) - calcPontos(a);
    });
  }, [membros, statusMap]);

  if (!isManager) {
    return (
      <div style={{ color: "var(--accent-red)", fontFamily: "var(--display)", letterSpacing: 1 }}>
        Acesso restrito para gestores.
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes gestaoLivePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .45; transform: scale(1.5); }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--display)",
                fontSize: "1.4rem",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Equipes ao vivo
            </h2>
            <p style={{ margin: "8px 0 0", color: "var(--text-mid)", fontSize: 13 }}>
              Status de jornada, pausas, equipes formadas e pontuacao em tempo real.
            </p>
          </div>

          <button
            className="btn btn-cancel"
            onClick={carregarTudo}
            disabled={loading}
            style={{ padding: "8px 16px", fontSize: 11, letterSpacing: 1.2 }}
          >
            {loading ? "ATUALIZANDO..." : "ATUALIZAR"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatCard label="Trabalhando" value={resumo.working} color="#00e87a" />
          <StatCard label="Em pausa" value={resumo.paused} color="#ffcc00" />
          <StatCard label="Encerrados" value={resumo.done} color="#7a9bbf" />
          <StatCard label="Nao iniciou" value={resumo.idle} color="#3a5570" />
        </div>

        {lastUpdate && (
          <div style={{ color: "var(--text-lo)", fontFamily: "var(--mono)", fontSize: 10 }}>
            Ultima sincronizacao: {fmtHM(lastUpdate)}
          </div>
        )}

        {loading && (
          <div style={{ color: "var(--accent-cyan)", fontFamily: "var(--mono)", padding: "24px 0" }}>
            Sincronizando equipe...
          </div>
        )}

        {!loading && erro && (
          <div
            style={{
              background: "rgba(255,59,85,0.08)",
              border: "1px solid rgba(255,59,85,0.3)",
              color: "#ff8095",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 13,
            }}
          >
            {erro}
          </div>
        )}

        {!loading && !erro && (
          <>
            <section>
              <h3
                style={{
                  margin: "0 0 12px",
                  color: "var(--accent-cyan)",
                  fontFamily: "var(--display)",
                  fontSize: 13,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Colaboradores em tempo real
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {membrosOrdenados.map((membro) => (
                  <ColaboradorRow key={membro.id} usuario={membro} statusInfo={statusMap[membro.id]} now={tick} />
                ))}

                {membrosOrdenados.length === 0 && (
                  <div style={{ color: "var(--text-lo)", fontSize: 13 }}>
                    Nenhum colaborador encontrado para acompanhar.
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3
                style={{
                  margin: "8px 0 12px",
                  color: "var(--accent-gold)",
                  fontFamily: "var(--display)",
                  fontSize: 13,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Equipes formadas e pontuacoes
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {equipes.map((equipe) => (
                  <TeamCard key={equipe.id} equipe={equipe} statusMap={statusMap} />
                ))}

                {equipes.length === 0 && (
                  <div style={{ color: "var(--text-lo)", fontSize: 13 }}>
                    Nenhuma equipe formada foi encontrada.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
