import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";
import LogoNexus from "./assets/logo-nexus.svg";
import Cadastro from "./cadastro";
function fmtTime(date) {
  if (!date) return "--:--:--";
  return new Date(date).toLocaleTimeString("pt-BR", { hour12: false });
}

function fmtSeconds(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0")
  );
}

function App() {
 const [screen, setScreen] = useState("intro"); // intro | login | cadastro | inicio | app

  const [isLogged, setIsLogged] = useState(false);
  const [userData, setUserData] = useState({ nome: "", perfil: "" });
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("ponto");

  const [status, setStatus] = useState("idle"); // idle | working | paused | done
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [pauseLog, setPauseLog] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      document.body.classList.add("started");
    }, 4500);

    const redirect = setTimeout(() => {
      setScreen("login");
    }, 6000);

    return () => {
      clearTimeout(timer);
      clearTimeout(redirect);
      document.body.classList.remove("started");
    };
  }, []);

  useEffect(() => {
    let interval = null;

    if (status === "working" || status === "paused") {
      interval = setInterval(() => {
        setNow(Date.now());
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const totalPauseSec = useMemo(() => {
    return pauseLog.reduce((acc, p) => {
      const end = p.out ?? now;
      return acc + Math.floor((end - p.in) / 1000);
    }, 0);
  }, [pauseLog, now]);

  const connectedSec = startTime ? Math.floor((now - startTime) / 1000) : 0;
  const workedSec = Math.max(0, connectedSec - totalPauseSec);

  function showToast(msg) {
    setToast(msg);
  }

  async function registrarNoBanco(tipo) {
    try {
      const token = localStorage.getItem("nexus_token");
      await axios.post(
        "http://127.0.0.1:5000/api/ponto/registrar",
        { tipo_registro: tipo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.error("Erro no registro:", e);
      showToast("Erro ao registrar no banco.");
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/api/auth/login",
        { cpf, senha }
      );

      localStorage.setItem("nexus_token", response.data.token);
      localStorage.setItem("nexus_nome", response.data.nome);
      localStorage.setItem("nexus_perfil", response.data.perfil);

      setUserData({
        nome: response.data.nome,
        perfil: response.data.perfil,
      });

      setIsLogged(true);
      setScreen("inicio");
    } catch (error) {
      console.error(error);
      alert("Dados inválidos");
    }
  }

  function handleLogout() {
    localStorage.clear();
    setIsLogged(false);
    setUserData({ nome: "", perfil: "" });
    setCpf("");
    setSenha("");
    setAbaAtiva("ponto");

    setStatus("idle");
    setStartTime(null);
    setEndTime(null);
    setPauseLog([]);
    setNow(Date.now());

    setScreen("login");
  }

  async function handleStart() {
    if (status !== "idle") {
      showToast("⚠ Jornada já iniciada!");
      return;
    }

    const current = Date.now();

    setStartTime(current);
    setEndTime(null);
    setPauseLog([]);
    setNow(current);
    setStatus("working");

    await registrarNoBanco("entrada");
    showToast(`✔ Jornada iniciada — ${fmtTime(current)}`);
  }

  async function handlePause() {
    if (status === "idle" || status === "done") {
      showToast("⚠ Ação não permitida neste estado.");
      return;
    }

    const current = Date.now();

    if (status === "working") {
      setPauseLog((prev) => [...prev, { in: current, out: null }]);
      setStatus("paused");
      await registrarNoBanco("pausa_inicio");
      showToast(`⏸ Pausa iniciada — ${fmtTime(current)}`);
    } else if (status === "paused") {
      setPauseLog((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && !last.out) {
          last.out = current;
        }
        return updated;
      });

      setStatus("working");
      await registrarNoBanco("pausa_fim");
      showToast(`▶ Retomado — ${fmtTime(current)}`);
    }

    setNow(current);
  }

  async function handleExit() {
    if (status === "idle" || status === "done") {
      showToast("⚠ Nenhuma jornada ativa.");
      return;
    }

    const current = Date.now();

    if (status === "paused") {
      setPauseLog((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && !last.out) {
          last.out = current;
        }
        return updated;
      });
    }

    setEndTime(current);
    setNow(current);
    setStatus("done");

    await registrarNoBanco("saida");
    showToast(`✔ Jornada encerrada — ${fmtTime(current)}`);
  }

  const statusMap = {
    idle: { badge: "idle", label: "Não Iniciado", chrono: "" },
    working: { badge: "working", label: "Trabalhando", chrono: "working" },
    paused: { badge: "paused", label: "Em Pausa", chrono: "paused" },
    done: { badge: "done", label: "Encerrado", chrono: "done" },
  };

  const currentStatus = statusMap[status];

  const pauseHint =
    status === "working"
      ? "JORNADA EM ANDAMENTO"
      : status === "paused"
      ? "RETORNE PARA CONTINUAR"
      : "";

  if (screen === "intro") {
    return (
      <>
        <div className="bg-pulse"></div>
        <div className="bg-vignette"></div>
        <div className="scanlines"></div>

        <main className="intro">
          <div className="flash"></div>
          <div className="logo-wrap">
            <div className="glow-ring"></div>
            <img src={LogoNexus} alt="Logo Nexus" className="logo" />
          </div>
        </main>
      </>
    );
  }

  if (screen === "login") {
    return (
      <div className="login-wrapper">
        <img src={LogoNexus} alt="Logo" className="logo-icon-outside" />

        <div className="login-card">
          <h1>LOGIN</h1>
          <p className="login-subtitle">Acesse o portal da equipe</p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <input
                type="text"
                placeholder="CPF"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="SENHA"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-button">
              ENTRAR
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
  <a href="#">ESQUECI A SENHA</a>
</div>
        </div>
      </div>
    );
  }
if (screen === "cadastro") {
  return <Cadastro onGoLogin={() => setScreen("login")} />;
}
  if (screen === "inicio" && isLogged) {
    return (
      <div className="wrapper">
        <header className="topbar">
          <div className="topbar__logo">
            <img src={LogoNexus} alt="Logo Nexus" />
          </div>

          <nav className="topbar__nav">
            <button className="active">MEU RELÓGIO</button>
            <button>HISTORICO</button>
            <button>HOLERITE</button>
            <button>MINHA EQUIPE</button>
            <button>RANKING</button>
            {userData.perfil !== "colaborador" && <button>GESTÃO</button>}
          </nav>

          <div className="topbar__user" onClick={handleLogout} title="Sair"></div>
        </header>

        <main className="hero">
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

  return (
    <div className="wrapper">
      <header className="topbar">
        <div className="topbar__logo">
          <img src={LogoNexus} alt="Logo Nexus" />
        </div>

        <nav className="topbar__nav">
          <button
            className={abaAtiva === "ponto" ? "active" : ""}
            onClick={() => setAbaAtiva("ponto")}
          >
            MEU RELÓGIO
          </button>

          <button>HISTORICO</button>
          <button>HOLERITE</button>
          <button>MINHA EQUIPE</button>
          <button>RANKING</button>

          {userData.perfil !== "colaborador" && (
            <button
              className={abaAtiva === "gestao" ? "active" : ""}
              onClick={() => setAbaAtiva("gestao")}
            >
              GESTÃO
            </button>
          )}
        </nav>

        <div className="topbar__user" onClick={handleLogout} title="Sair"></div>
      </header>

      <main>
        {abaAtiva === "ponto" ? (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Controle de Jornada</span>

              <div className={`badge ${currentStatus.badge}`}>
                <span className="badge-dot"></span>
                <span>{currentStatus.label}</span>
              </div>
            </div>

            <div className="grid">
              <div className="info-col">
                <div className="info-block">
                  <div className="info-label">Início</div>
                  <div className={`info-value ${!startTime ? "dim" : ""}`}>
                    {fmtTime(startTime)}
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-label">Pausas</div>

                  {pauseLog.length === 0 ? (
                    <span className="pause-empty">— sem pausas —</span>
                  ) : (
                    <table className="pause-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Entrada</th>
                          <th>Saída</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pauseLog.map((p, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{fmtTime(p.in)}</td>
                            {p.out ? (
                              <td>{fmtTime(p.out)}</td>
                            ) : (
                              <td className="open">em curso…</td>
                            )}
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

              <div className="chrono-area">
                <div className="chrono-label">Tempo Conectado</div>
                <div className={`chrono-display ${currentStatus.chrono}`}>
                  {fmtSeconds(connectedSec)}
                </div>
                <div className="next-pause-hint">{pauseHint}</div>
              </div>

              <div className="stats-area">
                <div className="stat-block">
                  <div className="info-label">Tempo Trabalhado</div>
                  <div className="stat-value worked">
                    {fmtSeconds(workedSec)}
                  </div>
                </div>

                <div className="stat-block">
                  <div className="info-label">Tempo em Pausas</div>
                  <div className="stat-value paused-t">
                    {fmtSeconds(totalPauseSec)}
                  </div>
                </div>
              </div>
            </div>

            <div className="actions">
              <button
                className="btn btn-start"
                onClick={handleStart}
                disabled={status !== "idle"}
              >
                Iniciar
              </button>

              <button
                className="btn btn-pause"
                onClick={handlePause}
                disabled={status === "idle" || status === "done"}
              >
                {status === "paused" ? "Retomar" : "Pausar"}
              </button>

              <button
                className="btn btn-exit"
                onClick={handleExit}
                disabled={status === "idle" || status === "done"}
              >
                Saída
              </button>
            </div>
          </div>
        ) : (
          <div className="panel" style={{ padding: "32px", color: "white" }}>
            <h2>Painel de Gestão</h2>
            <p style={{ marginTop: "12px", opacity: 0.8 }}>
              Área reservada para funções administrativas.
            </p>
          </div>
        )}
      </main>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}

export default App;