import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "./App.css";
import LogoNexus from "./assets/logo-nexus.svg";
import Cadastro from "./cadastro";
import { DailySummaryScreen } from "./components";
import Holerite from "./Holerite";
import MinhaEquipe from "./MinhaEquipe";
import ResetPassword from "./ResetPassword";
import Sininho from "./Sininho";
import MeuPerfil from "./MeuPerfil";
import Ranking from "./Ranking";
// ─── Utilitários ─────────────────────────────────────────────────────────────

const API_BASE = "http://127.0.0.1:5000/api";

function fmtTime(date) {
  if (!date) return "--:--:--";
  return new Date(date).toLocaleTimeString("pt-BR", { hour12: false });
}

function fmtSeconds(totalSec) {
  const safe = Number(totalSec || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatCpf(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatCelular(value) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.replace(/(\d{1,2})/, "($1");
  if (digits.length <= 7) return digits.replace(/(\d{2})(\d{1,5})/, "($1) $2");
  return digits.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
}

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Compressor de imagem ────────────────────────────────────────────────────

function compressImage(file, callback) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 250;
      const MAX_HEIGHT = 250;

      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      callback(dataUrl);
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
}

// ─── Mapa de status ─────────────────────────────────────────────────────────

const STATUS_MAP = {
  idle: { badge: "idle", label: "Não Iniciado", chrono: "", hint: "" },
  working: {
    badge: "working",
    label: "Trabalhando",
    chrono: "working",
    hint: "JORNADA EM ANDAMENTO",
  },
  paused: {
    badge: "paused",
    label: "Em Pausa",
    chrono: "paused",
    hint: "RETORNE PARA CONTINUAR",
  },
  done: { badge: "done", label: "Encerrado", chrono: "done", hint: "" },
};

// ─── Componente principal ───────────────────────────────────────────────────

function App() {
  // Telas: intro | login | cadastro | inicio | app
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const [gestaoCidade, setGestaoCidade] = useState("");
  const [gestaoCelular, setGestaoCelular] = useState("");
  const [gestaoPerfil, setGestaoPerfil] = useState("");
  const [screen, setScreen] = useState("intro");

  const query = new URLSearchParams(window.location.search);
  const resetToken = query.get("token");

  if (resetToken) {
    return <ResetPassword token={resetToken} />;
  }

  // Auth
  const [token, setToken] = useState(localStorage.getItem("nexus_token") || "");
  const [isLogged, setIsLogged] = useState(false);
  const [userData, setUserData] = useState({
    nome: "",
    perfil: "",
    foto_perfil: "",
    email: "",
    cidade: "",
    celular: "",
    data_nascimento: "",
  });
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

  // Resumo do dia
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [summarySnapshot, setSummarySnapshot] = useState(null);

  // Notificações
  const [notificacoes, setNotificacoes] = useState([]);
  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);
  const [notificacoesLoading, setNotificacoesLoading] = useState(false);

  // Modal do próprio perfil
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [showMeuPerfil, setShowMeuPerfil] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editFoto, setEditFoto] = useState("");
  const [editCidade, setEditCidade] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editDataNascimento, setEditDataNascimento] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  // Painel de gestão
  const [equipe, setEquipe] = useState([]);
  const [loadingEquipe, setLoadingEquipe] = useState(false);
  const [gestaoModal, setGestaoModal] = useState({ show: false, colab: null });
  const [gestaoNome, setGestaoNome] = useState("");
  const [gestaoFoto, setGestaoFoto] = useState("");
  const [salvandoGestao, setSalvandoGestao] = useState(false);

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

  // ── Carregar equipe (gestor) ─────────────────────────────────────────────

  useEffect(() => {
    if (abaAtiva === "gestao" && userData.perfil !== "colaborador") {
      carregarEquipe();
    }
  }, [abaAtiva, userData.perfil]);

  async function carregarEquipe() {
    setLoadingEquipe(true);
    try {
      const { data } = await axios.get(`${API_BASE}/gestor/equipe`, {
        headers: getAuthHeader(),
      });
      setEquipe(data.equipe || []);
    } catch {
      showToast("Erro ao carregar equipe.", "error");
    } finally {
      setLoadingEquipe(false);
    }
  }

  // ── Notificações ─────────────────────────────────────────────────────────

  const carregarNotificacoesNaoLidas = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/notificacoes/nao-lidas-count`, {
        headers: getAuthHeader(),
      });
      setNotificacoesNaoLidas(data.count ?? data.nao_lidas ?? 0);
    } catch (error) {
      console.warn("Erro ao carregar contagem de notificações:", error);
    }
  }, []);

  const carregarNotificacoes = useCallback(async () => {
    setNotificacoesLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/notificacoes`, {
        headers: getAuthHeader(),
      });
      setNotificacoes(data.notificacoes ?? data ?? []);
    } catch (error) {
      console.warn("Erro ao carregar notificações:", error);
    } finally {
      setNotificacoesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLogged) return;

    carregarNotificacoesNaoLidas();
    carregarNotificacoes();

    // Polling de backup a cada 15s (SSE já garante tempo real)
    const interval = setInterval(() => {
      carregarNotificacoesNaoLidas();
      carregarNotificacoes();
    }, 15000);

    return () => clearInterval(interval);
  }, [isLogged, carregarNotificacoesNaoLidas, carregarNotificacoes]);

  // ── Toast ────────────────────────────────────────────────────────────────

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

  const connectedSec =
    startTime && (status === "working" || status === "paused")
      ? Math.floor((now - startTime) / 1000)
      : startTime && endTime
      ? Math.floor((endTime - startTime) / 1000)
      : 0;

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
      setToken(data.token);

      setUserData({
        nome: data.nome,
        perfil: data.perfil,
        email: data.email,
        foto_perfil: data.foto_perfil || "",
        cidade: data.cidade || "",
        celular: data.celular || "",
        data_nascimento: data.data_nascimento || "",
      });
      setIsLogged(true);
      setScreen("inicio");

      // Carrega notificações logo após o login
      carregarNotificacoesNaoLidas();
      carregarNotificacoes();
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

  async function handleEsqueciSenha(e) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/esqueci-senha`, {
        email: forgotEmail,
      });
      showToast(response.data.mensagem, "success");
      setShowForgotModal(false);
      setForgotEmail("");
    } catch (err) {
      showToast(
        err.response?.data?.erro || "Erro ao solicitar recuperação",
        "error"
      );
    } finally {
      setForgotLoading(false);
    }
  }

  // ── Logout com resumo do dia ─────────────────────────────────────────────

  function handleLogout() {
    const snapshot = {
      startTime,
      endTime,
      pauseLog,
      connectedSec,
      workedSec,
      totalPauseSec,
    };

    setSummarySnapshot(snapshot);
    setShowPerfilModal(false);
    setShowDailySummary(true);
  }

  function handleCloseSummary() {
    setShowDailySummary(false);
    setSummarySnapshot(null);

    localStorage.clear();
    setToken("");
    setIsLogged(false);
    setUserData({
      nome: "",
      perfil: "",
      foto_perfil: "",
      email: "",
      cidade: "",
      celular: "",
      data_nascimento: "",
    });
    setCpf("");
    setSenha("");
    setLoginError("");
    setAbaAtiva("ponto");
    setStatus("idle");
    setStartTime(null);
    setEndTime(null);
    setPauseLog([]);
    setNow(Date.now());
    setShowPerfilModal(false);
    setNotificacoes([]);
    setNotificacoesNaoLidas(0);
    setScreen("login");
  }

  // ── Edição de perfil próprio ─────────────────────────────────────────────

  async function salvarPerfil() {
    setSalvandoPerfil(true);
    try {
      const { data } = await axios.put(
        `${API_BASE}/auth/perfil`,
        {
          nome: editNome,
          foto_perfil: editFoto,
          cidade: editCidade,
          celular: editCelular,
          data_nascimento: editDataNascimento,
        },
        { headers: getAuthHeader() }
      );

      setUserData((prev) => ({
        ...prev,
        nome: data.nome,
        foto_perfil: data.foto_perfil,
        cidade: data.cidade,
        celular: data.celular,
        data_nascimento: data.data_nascimento,
      }));
      localStorage.setItem("nexus_nome", data.nome);
      setShowPerfilModal(false);
      showToast("Perfil atualizado!", "success");
    } catch {
      showToast("Erro ao atualizar perfil", "error");
    } finally {
      setSalvandoPerfil(false);
    }
  }

  // ── Edição de colaborador (gestor) ───────────────────────────────────────

  async function salvarEdicaoGestor() {
    if (!gestaoModal.colab) return;

    setSalvandoGestao(true);
    try {
      await axios.put(
        `${API_BASE}/gestor/colaborador/${gestaoModal.colab.id}/perfil`,
        {
          nome: gestaoNome,
          foto_perfil: gestaoFoto,
          cidade: gestaoCidade,
          celular: gestaoCelular,
          perfil: gestaoPerfil,
        },
        { headers: getAuthHeader() }
      );

      showToast("Colaborador atualizado!", "success");
      setGestaoModal({ show: false, colab: null });
      carregarEquipe();
    } catch {
      showToast("Erro ao atualizar colaborador", "error");
    } finally {
      setSalvandoGestao(false);
    }
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
  const perfilLower = (userData.perfil || "").toLowerCase();
  const isManager = ["gestor", "admin"].includes(perfilLower);
  const isSupervisor = perfilLower === "supervisor";

  const userInitials = userData.nome
    ? userData.nome
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAIS
  // ═══════════════════════════════════════════════════════════════════════════

  const PerfilModal = () => (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card">
        <h3 className="modal-title">Meu Perfil</h3>

        {isSupervisor && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,204,0,0.12)",
              border: "1px solid rgba(255,204,0,0.35)",
              borderRadius: 6,
              padding: "4px 12px",
              marginBottom: 8,
              alignSelf: "flex-start",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--accent-gold)",
                fontFamily: "var(--display)",
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              ★ SUPERVISOR
            </span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            marginBottom: "24px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            {editFoto ? (
              <img
                src={editFoto}
                alt="Preview"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "#1e2d42",
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                📷
              </div>
            )}
          </div>

          <label
            style={{
              fontSize: "12px",
              color: "var(--text-mid)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Foto de Perfil:
            <input
              type="file"
              accept="image/*"
              onChange={(e) => compressImage(e.target.files[0], setEditFoto)}
              style={{ color: "white" }}
            />
          </label>

          <label
            style={{
              fontSize: "12px",
              color: "var(--text-mid)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Nome:
            <input
              type="text"
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
              placeholder="Seu Nome"
              style={{
                width: "100%",
                padding: "10px",
                background: "#111418",
                color: "white",
                border: "1px solid #4b5563",
                borderRadius: "8px",
                fontFamily: "var(--sans)",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: "10px" }}>
            <label
              style={{
                fontSize: "12px",
                color: "var(--text-mid)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                flex: 1,
              }}
            >
              Cidade:
              <input
                type="text"
                value={editCidade}
                onChange={(e) => setEditCidade(e.target.value)}
                style={{
                  padding: "10px",
                  background: "#111418",
                  color: "white",
                  border: "1px solid #4b5563",
                  borderRadius: "8px",
                  fontFamily: "var(--sans)",
                }}
              />
            </label>

            <label
              style={{
                fontSize: "12px",
                color: "var(--text-mid)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                flex: 1,
              }}
            >
              Celular:
              <input
                type="text"
                value={editCelular}
                onChange={(e) => setEditCelular(formatCelular(e.target.value))}
                style={{
                  padding: "10px",
                  background: "#111418",
                  color: "white",
                  border: "1px solid #4b5563",
                  borderRadius: "8px",
                  fontFamily: "var(--sans)",
                }}
              />
            </label>
          </div>

          <label
            style={{
              fontSize: "12px",
              color: "var(--text-mid)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Data de Nascimento:
            <input
              type="date"
              value={editDataNascimento}
              onChange={(e) => setEditDataNascimento(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                background: "#111418",
                color: "white",
                border: "1px solid #4b5563",
                borderRadius: "8px",
                fontFamily: "var(--sans)",
              }}
            />
          </label>
        </div>

        <div className="modal-actions" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-exit" onClick={handleLogout}>
            Sair da Conta
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn btn-cancel"
              onClick={() => setShowPerfilModal(false)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-start"
              onClick={salvarPerfil}
              disabled={salvandoPerfil}
            >
              {salvandoPerfil ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const ModalEdicaoGestor = () => (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card">
        <h3 className="modal-title">Editar Colaborador</h3>
        <p className="modal-body" style={{ marginTop: "-10px" }}>
          {gestaoModal.colab?.cpf}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            marginBottom: "24px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            {gestaoFoto ? (
              <img
                src={gestaoFoto}
                alt="Preview"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "#1e2d42",
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                👤
              </div>
            )}
          </div>

          <label
            style={{
              fontSize: "12px",
              color: "var(--text-mid)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Nova Foto:
            <input
              type="file"
              accept="image/*"
              onChange={(e) => compressImage(e.target.files[0], setGestaoFoto)}
              style={{ color: "white" }}
            />
          </label>

          <label
            style={{
              fontSize: "12px",
              color: "var(--text-mid)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Nome do Colaborador:
            <input
              type="text"
              value={gestaoNome}
              onChange={(e) => setGestaoNome(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                background: "#111418",
                color: "white",
                border: "1px solid #4b5563",
                borderRadius: "8px",
                fontFamily: "var(--sans)",
              }}
            />
          </label>

          <label
            style={{
              fontSize: "12px",
              color: "var(--text-mid)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Cidade:
            <input
              type="text"
              value={gestaoCidade}
              onChange={(e) => setGestaoCidade(e.target.value)}
              style={{
                padding: "10px",
                background: "#111418",
                color: "white",
                border: "1px solid #4b5563",
                borderRadius: "8px",
              }}
            />
          </label>

          <label
            style={{
              fontSize: "12px",
              color: "var(--text-mid)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Celular:
            <input
              type="text"
              value={gestaoCelular}
              onChange={(e) => setGestaoCelular(e.target.value)}
              style={{
                padding: "10px",
                background: "#111418",
                color: "white",
                border: "1px solid #4b5563",
                borderRadius: "8px",
              }}
            />
          </label>

          <label
            style={{
              fontSize: "12px",
              color: "var(--text-mid)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Perfil de Acesso:
            <select
              value={gestaoPerfil}
              onChange={(e) => setGestaoPerfil(e.target.value)}
              style={{
                padding: "10px",
                background: "#111418",
                color: "white",
                border: "1px solid #4b5563",
                borderRadius: "8px",
              }}
            >
              <option value="colaborador">Colaborador</option>
              <option value="supervisor">Supervisor</option>
              <option value="gestor">Gestor</option>
            </select>
          </label>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-cancel"
            onClick={() => setGestaoModal({ show: false, colab: null })}
          >
            Cancelar
          </button>
          <button
            className="btn btn-start"
            onClick={salvarEdicaoGestor}
            disabled={salvandoGestao}
          >
            {salvandoGestao ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERS
  // ═══════════════════════════════════════════════════════════════════════════

  if (showDailySummary) {
    return (
      <DailySummaryScreen
        localAppState={summarySnapshot}
        onClose={handleCloseSummary}
        userName={userData.nome}
      />
    );
  }

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

  if (screen === "cadastro") {
    return <Cadastro onGoLogin={() => setScreen("login")} />;
  }

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

            <button type="submit" className="login-button" disabled={loginLoading}>
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
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setShowForgotModal(true);
              }}
            >
              ESQUECI A SENHA
            </a>
          </div>
        </div>

        {showForgotModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3 className="modal-title">Recuperar Senha</h3>
              <p className="modal-body">
                Digite o e-mail cadastrado na sua conta para receber o link de
                recuperação.
              </p>

              <form onSubmit={handleEsqueciSenha}>
                <div className="input-group" style={{ marginBottom: "20px" }}>
                  <input
                    type="email"
                    placeholder="Seu E-mail"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "#111418",
                      color: "white",
                      border: "1px solid #4b5563",
                      borderRadius: "2rem",
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-cancel"
                    onClick={() => setShowForgotModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-start"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? "Enviando..." : "Enviar Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

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
        <button disabled title="Em breve">
          HISTÓRICO
        </button>
        <button
          className={abaAtiva === "holerite" ? "active" : ""}
          onClick={() => {
            setAbaAtiva("holerite");
            if (screen !== "app") setScreen("app");
          }}
        >
          HOLERITE
        </button>
        <button
          className={abaAtiva === "equipe" ? "active" : ""}
          onClick={() => {
            setAbaAtiva("equipe");
            if (screen !== "app") setScreen("app");
          }}
        >
          MINHA EQUIPE
        </button>
        <button
          className={abaAtiva === "ranking" ? "active" : ""}
          onClick={() => setAbaAtiva("ranking")}
        >
           RANKING
        </button>

        <Sininho
          token={token}
          count={notificacoesNaoLidas}
          notifications={notificacoes}
          loading={notificacoesLoading}
          onRefresh={carregarNotificacoes}
          onNavegar={(aba) => {
            setAbaAtiva(aba);
            setScreen("app");
          }}
        />

        {isManager && (
          <button
            className={abaAtiva === "gestao" ? "active" : ""}
            onClick={() => {
              setAbaAtiva("gestao");
              if (screen !== "app") setScreen("app");
            }}
          >
            GESTÃO
          </button>
        )}
      </nav>

      <div style={{ position: "relative", justifySelf: "end" }}>
        <div
          className="topbar__user"
          onClick={() => setShowAvatarMenu((v) => !v)}
          title="Perfil"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setShowAvatarMenu((v) => !v)}
        >
          {userData.foto_perfil ? (
            <img
              src={userData.foto_perfil}
              alt="Perfil"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span className="topbar__user-initials">{userInitials}</span>
          )}
        </div>

        {showAvatarMenu && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 998 }}
              onClick={() => setShowAvatarMenu(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                background: "var(--bg-card)",
                border: "1px solid var(--border-hi)",
                borderRadius: 10,
                minWidth: 170,
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                zIndex: 999,
                overflow: "hidden",
                animation: "fadeIn 0.12s ease",
              }}
            >
              <button
                onClick={() => {
                  setShowAvatarMenu(false);
                  setShowMeuPerfil(true);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-hi)",
                  fontFamily: "var(--display)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1,
                  padding: "13px 18px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(0,200,255,0.07)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span style={{ fontSize: 14 }}>👤</span>
                MEU PERFIL
              </button>
              <button
                onClick={() => {
                  setShowAvatarMenu(false);
                  setEditNome(userData.nome || "");
                  setEditFoto(userData.foto_perfil || "");
                  setEditCidade(userData.cidade || "");
                  setEditCelular(userData.celular || "");
                  setEditDataNascimento(userData.data_nascimento || "");
                  setShowPerfilModal(true);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-mid)",
                  fontFamily: "var(--display)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1,
                  padding: "13px 18px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span style={{ fontSize: 14 }}>✏️</span>
                EDITAR PERFIL
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );

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
            <button className="hero-card__button" onClick={() => setScreen("app")}>
              INICIAR JORNADA
            </button>
          </section>
        </main>

        {showPerfilModal && PerfilModal()}
        {showMeuPerfil && (
          <MeuPerfil userData={userData} onClose={() => setShowMeuPerfil(false)} />
        )}
      </div>
    );
  }

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

              <div className="chrono-area">
                <div className="chrono-label">Tempo Conectado</div>
                <div
                  className={`chrono-display chrono-display--${currentStatus.chrono}`}
                  aria-live="off"
                >
                  {fmtSeconds(connectedSec)}
                </div>
                <div className="next-pause-hint" aria-live="polite">
                  {currentStatus.hint}
                </div>
              </div>

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

            <div className="actions">
              <button
                className="btn btn-start"
                onClick={handleStart}
                disabled={status !== "idle" || actionLoading}
              >
                {actionLoading && status === "idle" ? (
                  <span className="spinner spinner--dark" />
                ) : null}
                Iniciar
              </button>

              <button
                className="btn btn-pause"
                onClick={handlePause}
                disabled={status === "idle" || status === "done" || actionLoading}
              >
                {status === "paused" ? "Retomar" : "Pausar"}
              </button>

              <button
                className="btn btn-exit"
                onClick={handleExit}
                disabled={status === "idle" || status === "done" || actionLoading}
              >
                Saída
              </button>
            </div>
          </div>
        ) : abaAtiva === "holerite" ? (
          <Holerite userData={userData} />
        ) : abaAtiva === "equipe" ? (
          <MinhaEquipe userData={userData} />
        ) : abaAtiva === "ranking" ? (
          <Ranking />
        ) : (
          <div
            className="panel panel--gestao"
            style={{
              padding: "32px",
              maxWidth: "860px",
              width: "100%",
              color: "white",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--display)",
                fontSize: "1.4rem",
                letterSpacing: "1px",
              }}
            >
              Painel de Gestão
            </h2>
            <p
              style={{
                opacity: 0.7,
                fontSize: "0.9rem",
                marginTop: "8px",
                marginBottom: "24px",
              }}
            >
              Gerencie sua equipe e atualize informações.
            </p>

            {loadingEquipe ? (
              <p
                style={{
                  color: "var(--accent-cyan)",
                  fontFamily: "var(--mono)",
                }}
              >
                Carregando dados da equipe...
              </p>
            ) : equipe.length === 0 ? (
              <p style={{ opacity: 0.5 }}>
                Nenhum colaborador encontrado na sua equipe.
              </p>
            ) : (
              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                <table
                  className="pause-table"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead style={{ background: "var(--bg-card2)" }}>
                    <tr>
                      <th
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        FOTO
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        NOME
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        CPF
                      </th>
                      <th
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border)",
                          textAlign: "right",
                        }}
                      >
                        AÇÕES
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipe.map((colab) => (
                      <tr
                        key={colab.id}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          {colab.foto_perfil ? (
                            <img
                              src={colab.foto_perfil}
                              alt={colab.nome}
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(135deg, #1e2d42, #111927)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontWeight: "bold",
                              }}
                            >
                              👤
                            </div>
                          )}
                        </td>

                        <td
                          style={{
                            padding: "12px 16px",
                            color: "var(--text-hi)",
                            fontFamily: "var(--sans)",
                            fontSize: "14px",
                          }}
                        >
                          {colab.nome}
                          {colab.perfil === "gestor" && (
                            <span
                              style={{
                                fontSize: "10px",
                                background: "var(--accent-cyan)",
                                color: "black",
                                padding: "2px 6px",
                                borderRadius: "10px",
                                marginLeft: "8px",
                                fontWeight: "bold",
                              }}
                            >
                              GESTOR
                            </span>
                          )}
                        </td>

                        <td
                          style={{
                            padding: "12px 16px",
                            color: "var(--text-mid)",
                            fontFamily: "var(--mono)",
                            fontSize: "13px",
                          }}
                        >
                          {formatCpf(colab.cpf)}
                        </td>

                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            className="btn btn-cancel"
                            style={{
                              padding: "6px 14px",
                              fontSize: "11px",
                              letterSpacing: "1px",
                            }}
                            onClick={() => {
                              setGestaoNome(colab.nome);
                              setGestaoFoto(colab.foto_perfil || "");
                              setGestaoCidade(colab.cidade || "");
                              setGestaoCelular(colab.celular || "");
                              setGestaoPerfil(colab.perfil || "colaborador");
                              setGestaoModal({ show: true, colab });
                            }}
                          >
                            EDITAR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <div
        className={`toast toast--${toast.type} ${toast.msg ? "show" : ""}`}
        role="status"
      >
        {toast.msg}
      </div>

      {confirmExit && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="modal-title">Encerrar Jornada?</h3>
            <p className="modal-body">
              Tem certeza que deseja registrar sua saída?
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-cancel"
                onClick={() => setConfirmExit(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-exit" onClick={confirmHandleExit}>
                Confirmar Saída
              </button>
            </div>
          </div>
        </div>
      )}

      {showPerfilModal && PerfilModal()}
      {gestaoModal.show && ModalEdicaoGestor()}
      {showMeuPerfil && (
        <MeuPerfil userData={userData} onClose={() => setShowMeuPerfil(false)} />
      )}
    </div>
  );
}

export default App;