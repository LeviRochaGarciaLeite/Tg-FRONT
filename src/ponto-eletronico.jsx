import React, { useEffect, useMemo, useState } from "react";


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

export default function PontoEletronico() {
  const [status, setStatus] = useState("idle"); // idle | working | paused | done
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [pauseLog, setPauseLog] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState("");

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

  function handleStart() {
    if (status !== "idle") {
      showToast("⚠ Jornada já iniciada!");
      return;
    }

    const current = Date.now();
    setStartTime(current);
    setNow(current);
    setStatus("working");
    showToast(`✔ Jornada iniciada — ${fmtTime(current)}`);
  }

  function handlePause() {
    if (status === "idle" || status === "done") {
      showToast("⚠ Ação não permitida neste estado.");
      return;
    }

    const current = Date.now();

    if (status === "working") {
      setPauseLog((prev) => [...prev, { in: current, out: null }]);
      setStatus("paused");
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
      showToast(`▶ Retomado — ${fmtTime(current)}`);
    }

    setNow(current);
  }

  function handleExit() {
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

  return (
    <div className="wrapper">
      <header className="topbar">
        <div className="topbar__logo">
          <img src="/logo-nexus.svg" alt="Logo Nexus" />
        </div>

        <nav className="topbar__nav">
          <a href="#" className="active">MEU RELÓGIO</a>
          <a href="#">HISTORICO</a>
          <a href="#">HOLERITE</a>
          <a href="#">MINHA EQUIPE</a>
          <a href="#">RANKING</a>
          <a href="#">GESTÃO</a>
        </nav>

        <div className="topbar__user"></div>
      </header>

      <main>
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
      </main>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}