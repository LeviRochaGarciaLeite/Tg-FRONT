import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "./App.css";
import LogoNexus from "./assets/logo-nexus.svg";
import Cadastro from "./cadastro";

// ─── Utilitários ─────────────────────────────────────────────────────────────

const API_BASE = "http://127.0.0.1:5000/api";

function fmtTime(date) {
  if (!date) return "--:--:--";
  return new Date(date).toLocaleTimeString("pt-BR", { hour12: false });
}

function fmtSeconds(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatCpf(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Mapa de status ───────────────────────────────────────────────────────────

const STATUS_MAP = {
  idle:    { badge: "idle",    label: "Não Iniciado", chrono: "",        hint: "" },
  working: { badge: "working", label: "Trabalhando",  chrono: "working", hint: "JORNADA EM ANDAMENTO" },
  paused:  { badge: "paused",  label: "Em Pausa",     chrono: "paused",  hint: "RETORNE PARA CONTINUAR" },
  done:    { badge: "done",    label: "Encerrado",    chrono: "done",    hint: "" },
};

// ─── Componente principal ─────────────────────────────────────────────────────

function App() {
  // Telas: intro | login | cadastro | inicio | app
  const [screen, setScreen] = useState("intro");

  // Auth
  const [isLogged, setIsLogged] = useState(false);
  const [userData, setUserData] = useState({ nome: "", perfil: "" });
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Navegação interna
  const [abaAtiva, setAbaAtiva] = useState("ponto");

  // Controle de jornada
  const [status, setStatus] = useState("idle");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [pauseLog, setPauseLog] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [actionLoading, setActionLoading] = useState(false);

  // Feedback visual
  const [toast, setToast] = useState({ msg: "", type: "info" });
  const [confirmExit, setConfirmExit] = useState(false);

  // ── Intro: transição automática ──────────────────────────────────────────

  useEffect(() => {
    const timerStarted = setTimeout(() => {
      document.body.classList.add("started");
    }, 4500);

    const timerRedirect = setTimeout(() => {
      setScreen("login");
    }, 6000);

    return () => {
      clearTimeout(timerStarted);
      clearTimeout(timerRedirect);
      document.body.classList.remove("started");
    };
  }, []);

  // ── Cronômetro ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (status !== "working" && status !== "paused") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  // ── Toast com tipo (info | error | success) ──────────────────────────────

  useEffect(() => {
    if (!toast.msg) return;
    const timer = setTimeout(() => setToast({ msg: "", type: "info" }), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
  }, []);

  // ── Cálculos de tempo ────────────────────────────────────────────────────

  const totalPauseSec = useMemo(() => {
    return pauseLog.reduce((acc, p) => {
      const end = p.out ?? now;
      return acc + Math.floor((end - p.in) / 1000);
    }, 0);
  }, [pauseLog, now]);

  const connectedSec = startTime ? Math.floor((now - startTime) / 1000) : 0;
  const workedSec = Math.max(0, connectedSec - totalPauseSec);

  // ── Integração com backend ───────────────────────────────────────────────

  async function registrarNoBanco(tipo) {
    try {
      await axios.post(
        `${API_BASE}/ponto/registrar`,
        { tipo_registro: tipo },
        { headers: getAuthHeader() }
      );
    } catch (e) {
      console.error("Erro no registro de ponto:", e);
      showToast("Erro ao registrar no banco. Verifique a conexão.", "error");
    }
  }

  // ── Login ────────────────────────────────────────────────────────────────

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const { data } = await axios.post(`${API_BASE}/auth/login`, {
        cpf: cpf.replace(/\D/g, ""),
        senha,
      });

      localStorage.setItem("nexus_token", data.token);
      localStorage.setItem("nexus_nome", data.nome);
      localStorage.setItem("nexus_perfil", data.perfil);

      setUserData({ nome: data.nome, perfil: data.perfil });
      setIsLogged(true);
      setScreen("inicio");
    } catch (error) {
      const msg =
        error?.response?.data?.erro ||
        (error?.response?.status === 401
          ? "CPF ou senha incorretos."
          : "Falha na conexão. Tente novamente.");
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────

  function handleLogout() {
    localStorage.clear();
    setIsLogged(false);
    setUserData({ nome: "", perfil: "" });
    setCpf("");
    setSenha("");
    setLoginError("");
    setAbaAtiva("ponto");
    setStatus("idle");
    setStartTime(null);
    setEndTime(null);
    setPauseLog([]);
    setNow(Date.now());
    setScreen("login");
  }

  // ── Ações de jornada ─────────────────────────────────────────────────────

  async function handleStart() {
    if (status !== "idle") {
      showToast("Jornada já iniciada!", "error");
      return;
    }
    const current = Date.now();
    setStartTime(current);
    setEndTime(null);
    setPauseLog([]);
    setNow(current);
    setStatus("working");
    setActionLoading(true);
    await registrarNoBanco("entrada");
    setActionLoading(false);
    showToast(`Jornada iniciada — ${fmtTime(current)}`, "success");
  }

  async function handlePause() {
    if (status === "idle" || status === "done") {
      showToast("Ação não permitida neste estado.", "error");
      return;
    }
    const current = Date.now();
    setActionLoading(true);

    if (status === "working") {
      setPauseLog((prev) => [...prev, { in: current, out: null }]);
      setStatus("paused");
      await registrarNoBanco("pausa_inicio");
      showToast(`Pausa iniciada — ${fmtTime(current)}`, "info");
    } else {
      setPauseLog((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && !last.out) last.out = current;
        return updated;
      });
      setStatus("working");
      await registrarNoBanco("pausa_fim");
      showToast(`Retomado — ${fmtTime(current)}`, "success");
    }

    setNow(current);
    setActionLoading(false);
  }

  async function handleExit() {
    if (status === "idle" || status === "done") {
      showToast("Nenhuma jornada ativa.", "error");
      return;
    }
    // Pede confirmação antes de encerrar
    setConfirmExit(true);
  }

  async function confirmHandleExit() {
    setConfirmExit(false);
    const current = Date.now();
    setActionLoading(true);

    if (status === "paused") {
      setPauseLog((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && !last.out) last.out = current;
        return updated;
      });
    }

    setEndTime(current);
    setNow(current);
    setStatus("done");
    await registrarNoBanco("saida");
    setActionLoading(false);
    showToast(`Jornada encerrada — ${fmtTime(current)}`, "success");
  }

  // ── Derivados ────────────────────────────────────────────────────────────

  const currentStatus = STATUS_MAP[status];
  const isManager = userData.perfil && userData.perfil !== "colaborador";

  // ── Iniciais do usuário para avatar ──────────────────────────────────────

  const userInitials = userData.nome
    ? userData.nome
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tela de Intro ─────────────────────────────────────────────────────────

  if (screen === "intro") {
    return (
      <>
        <div className="bg-pulse" aria-hidden="true" />
        <div className="bg-vignette" aria-hidden="true" />
        <div className="scanlines" aria-hidden="true" />
        <main className="intro" aria-label="Carregando Nexus">
          <div className="flash" aria-hidden="true" />
          <div className="logo-wrap">
            <div className="glow-ring" aria-hidden="true" />
            <img src={LogoNexus} alt="Logo Nexus" className="logo" />
          </div>
        </main>
      </>
    );
  }

  // ── Tela de Cadastro ──────────────────────────────────────────────────────

  if (screen === "cadastro") {
    return <Cadastro onGoLogin={() => setScreen("login")} />;
  }

  // ── Tela de Login ─────────────────────────────────────────────────────────

  if (screen === "login") {
    return (
      <div className="login-wrapper">
        <img src={LogoNexus} alt="Logo Nexus" className="logo-icon-outside" />

        <div className="login-card">
          <h1>LOGIN</h1>
          <p className="login-subtitle">Acesse o portal da equipe</p>

          <form onSubmit={handleLogin} className="login-form" noValidate>
            <div className="input-group">
              <input
                type="text"
                placeholder="CPF"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                inputMode="numeric"
                autoComplete="username"
                required
                aria-label="CPF"
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="SENHA"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
                aria-label="Senha"
              />
            </div>

            {loginError && (
              <div className="login-error" role="alert">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <span className="btn-loading">
                  <span className="spinner" />
                  ENTRANDO…
                </span>
              ) : (
                "ENTRAR"
              )}
            </button>
          </form>

          <div className="login-footer">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setScreen("cadastro");
              }}
            >
              CRIAR CONTA
            </a>
            <a href="#" onClick={(e) => e.preventDefault()}>
              ESQUECI A SENHA
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Topbar compartilhada ──────────────────────────────────────────────────

  const Topbar = () => (
    <header className="topbar">
      <div className="topbar__logo">
        <img src={LogoNexus} alt="Logo Nexus" />
      </div>

      <nav className="topbar__nav" aria-label="Menu principal">
        <button
          className={abaAtiva === "ponto" && screen === "app" ? "active" : ""}
          onClick={() => {
            setAbaAtiva("ponto");
            if (screen !== "app") setScreen("app");
          }}
        >
          MEU RELÓGIO
        </button>
        <button disabled title="Em breve">HISTÓRICO</button>
        <button disabled title="Em breve">HOLERITE</button>
        <button disabled title="Em breve">MINHA EQUIPE</button>
        <button disabled title="Em breve">RANKING</button>
        {isManager && (
          <button
            className={abaAtiva === "gestao" ? "active" : ""}
            onClick={() => setAbaAtiva("gestao")}
          >
            GESTÃO
          </button>
        )}
      </nav>

      <div
        className="topbar__user"
        onClick={handleLogout}
        title={`Sair (${userData.nome || "usuário"})`}
        role="button"
        aria-label="Sair da conta"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleLogout()}
      >
        <span className="topbar__user-initials">{userInitials}</span>
      </div>
    </header>
  );

  // ── Tela de Início (hero) ─────────────────────────────────────────────────

  if (screen === "inicio" && isLogged) {
    return (
      <div className="wrapper">
        <Topbar />

        <main className="hero">
          {userData.nome && (
            <p className="hero-greeting">
              Olá, <strong>{userData.nome.split(" ")[0]}</strong>
            </p>
          )}
          <section className="hero-card">
            <img src={LogoNexus} alt="Nexus" className="hero-card__logo" />

            <button
              className="hero-card__button"
              onClick={() => setScreen("app")}
            >
              INICIAR JORNADA
            </button>
          </section>
        </main>
      </div>
    );
  }

  // ── Tela principal (ponto) ────────────────────────────────────────────────

  return (
    <div className="wrapper">
      <Topbar />

      <main>
        {abaAtiva === "ponto" ? (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Controle de Jornada</span>
              <div className={`badge badge--${currentStatus.badge}`}>
                <span className="badge-dot" aria-hidden="true" />
                <span>{currentStatus.label}</span>
              </div>
            </div>

            <div className="grid">
              {/* Coluna de informações */}
              <div className="info-col">
                <div className="info-block">
                  <div className="info-label">Início</div>
                  <div className={`info-value ${!startTime ? "dim" : ""}`}>
                    {fmtTime(startTime)}
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-label">
                    Pausas
                    {pauseLog.length > 0 && (
                      <span className="pause-count"> ({pauseLog.length})</span>
                    )}
                  </div>

                  {pauseLog.length === 0 ? (
                    <span className="pause-empty">— sem pausas —</span>
                  ) : (
                    <table className="pause-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Início</th>
                          <th>Fim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pauseLog.map((p, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{fmtTime(p.in)}</td>
                            <td className={!p.out ? "open" : ""}>
                              {p.out ? fmtTime(p.out) : "em curso…"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="info-block">
                  <div className="info-label">Fim</div>
                  <div className={`info-value ${!endTime ? "dim" : ""}`}>
                    {fmtTime(endTime)}
                  </div>
                </div>
              </div>

              {/* Cronômetro */}
              <div className="chrono-area">
                <div className="chrono-label">Tempo Conectado</div>
                <div
                  className={`chrono-display chrono-display--${currentStatus.chrono}`}
                  aria-live="off"
                  aria-label={`Tempo conectado: ${fmtSeconds(connectedSec)}`}
                >
                  {fmtSeconds(connectedSec)}
                </div>
                <div className="next-pause-hint" aria-live="polite">
                  {currentStatus.hint}
                </div>
              </div>

              {/* Estatísticas */}
              <div className="stats-area">
                <div className="stat-block">
                  <div className="info-label">Tempo Trabalhado</div>
                  <div className="stat-value stat-value--worked">
                    {fmtSeconds(workedSec)}
                  </div>
                </div>

                <div className="stat-block">
                  <div className="info-label">Tempo em Pausas</div>
                  <div className="stat-value stat-value--paused">
                    {fmtSeconds(totalPauseSec)}
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="actions">
              <button
                className="btn btn-start"
                onClick={handleStart}
                disabled={status !== "idle" || actionLoading}
                aria-label="Iniciar jornada"
              >
                {actionLoading && status === "idle" ? <span className="spinner spinner--dark" /> : null}
                Iniciar
              </button>

              <button
                className="btn btn-pause"
                onClick={handlePause}
                disabled={status === "idle" || status === "done" || actionLoading}
                aria-label={status === "paused" ? "Retomar jornada" : "Pausar jornada"}
              >
                {status === "paused" ? "Retomar" : "Pausar"}
              </button>

              <button
                className="btn btn-exit"
                onClick={handleExit}
                disabled={status === "idle" || status === "done" || actionLoading}
                aria-label="Encerrar jornada"
              >
                Saída
              </button>
            </div>
          </div>
        ) : (
          <div className="panel panel--gestao">
            <h2>Painel de Gestão</h2>
            <p>Área reservada para funções administrativas.</p>
          </div>
        )}
      </main>

      {/* Toast de feedback */}
      <div
        className={`toast toast--${toast.type} ${toast.msg ? "show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast.msg}
      </div>

      {/* Modal de confirmação de saída */}
      {confirmExit && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirmar encerramento">
          <div className="modal-card">
            <h3 className="modal-title">Encerrar Jornada?</h3>
            <p className="modal-body">
              Tem certeza que deseja registrar sua saída?
              {status === "paused" && " A pausa ativa será finalizada automaticamente."}
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-cancel"
                onClick={() => setConfirmExit(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-exit"
                onClick={confirmHandleExit}
              >
                Confirmar Saída
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
