/**
 * Sininho.jsx — Notificações em tempo real via SSE + polling de backup
 *
 * CORREÇÃO: o estado local (localNotifs / localCount) é a fonte da verdade.
 * A prop `notifications` só inicializa o estado uma vez, e nunca sobrescreve
 * após o usuário interagir — evita o bug de "sumir notificações ao abrir".
 */

import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getToken() {
  return localStorage.getItem("nexus_token") || "";
}

function BellIcon({ hasUnread, shaking }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={hasUnread ? "#00c8ff" : "rgba(255,255,255,0.88)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "stroke 0.2s ease",
        filter: hasUnread ? "drop-shadow(0 0 6px rgba(0,200,255,0.6))" : "none",
        animation: shaking ? "siNinhoBell 0.8s ease" : "none",
      }}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function tipoIcon(tipo) {
  const map = { equipe: "👥", senha: "🔑", holerite: "📄", ponto: "🕐", perfil: "✏️", conta: "⚙️" };
  return map[tipo] || "🔔";
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} dias`;
  return new Date(isoString).toLocaleDateString("pt-BR");
}

const styles = {
  wrapper: { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  bellBtn: { background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", position: "relative", transition: "background 0.15s" },
  badge: { position: "absolute", top: "2px", right: "2px", minWidth: "16px", height: "16px", background: "#ff3b55", borderRadius: "999px", fontSize: "10px", fontWeight: "700", fontFamily: "var(--mono, monospace)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1, pointerEvents: "none", boxShadow: "0 0 8px rgba(255,59,85,0.7)", animation: "siNinhoPulse 1.8s ease-in-out infinite" },
  dropdown: { position: "absolute", top: "calc(100% + 10px)", right: "-8px", width: "340px", maxWidth: "95vw", background: "#111927", border: "1px solid #2a4060", borderRadius: "14px", boxShadow: "0 20px 60px rgba(0,0,0,0.85)", zIndex: 9999, overflow: "hidden", animation: "siNinhoFadeSlide 0.14s ease" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: "1px solid #1e2d42" },
  headerTitle: { fontFamily: "var(--display, Rajdhani, sans-serif)", fontSize: "13px", fontWeight: "700", letterSpacing: "1px", color: "#e8f4ff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" },
  headerActions: { display: "flex", gap: "6px", alignItems: "center" },
  linkBtn: { background: "transparent", border: "none", cursor: "pointer", color: "#00c8ff", fontSize: "11px", fontFamily: "var(--display, Rajdhani, sans-serif)", fontWeight: "600", letterSpacing: "0.5px", padding: "2px 6px", borderRadius: "4px", transition: "opacity 0.15s" },
  list: { maxHeight: "360px", overflowY: "auto", padding: "6px 0" },
  emptyState: { textAlign: "center", padding: "36px 20px", color: "#3a5570", fontFamily: "var(--sans, 'Exo 2', sans-serif)", fontSize: "13px" },
  emptyIcon: { fontSize: "32px", marginBottom: "8px", display: "block", opacity: 0.5 },
  item: (lida) => ({ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", cursor: "pointer", background: lida ? "transparent" : "rgba(0, 200, 255, 0.04)", borderBottom: "1px solid rgba(30,45,66,0.5)", transition: "background 0.15s", position: "relative" }),
  itemIcon: { fontSize: "18px", lineHeight: 1, flexShrink: 0, marginTop: "2px" },
  itemContent: { flex: 1, minWidth: 0 },
  itemMsg: (lida) => ({ fontSize: "12.5px", fontFamily: "var(--sans, 'Exo 2', sans-serif)", color: lida ? "#7a9bbf" : "#e8f4ff", fontWeight: lida ? "400" : "500", lineHeight: "1.45", wordBreak: "break-word" }),
  itemTime: { fontSize: "10px", color: "#3a5570", fontFamily: "var(--mono, monospace)", marginTop: "3px" },
  unreadDot: { width: "7px", height: "7px", borderRadius: "50%", background: "#00c8ff", flexShrink: 0, marginTop: "5px", boxShadow: "0 0 5px rgba(0,200,255,0.6)" },
  deleteBtn: { background: "transparent", border: "none", cursor: "pointer", color: "#3a5570", fontSize: "14px", padding: "2px 4px", borderRadius: "4px", flexShrink: 0, lineHeight: 1, transition: "color 0.15s" },
  footer: { borderTop: "1px solid #1e2d42", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  loadingRow: { textAlign: "center", padding: "24px", color: "#3a5570", fontFamily: "var(--mono, monospace)", fontSize: "12px" },
};

const KEYFRAMES = `
@keyframes siNinhoPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes siNinhoFadeSlide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes siNinhoBell { 0%,100% { transform: rotate(0deg); } 10%,30% { transform: rotate(-12deg); } 20%,40% { transform: rotate(12deg); } 50% { transform: rotate(0deg); } }
@keyframes ssePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
`;

let keyframesInjected = false;
function injectKeyframes() {
  if (keyframesInjected) return;
  const style = document.createElement("style");
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
  keyframesInjected = true;
}

/* ── Hook SSE ──────────────────────────────────────────────────────────── */
function useSSENotifications({ isLogged, onNewNotification }) {
  const esRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const connectRef = useRef(null);
  const [sseConnected, setSseConnected] = useState(false);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token || !isLogged) return;
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const url = `${API_BASE}/notificacoes/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setSseConnected(true);
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.tipo === "__connected__") return;
        onNewNotification(data);
      } catch { /* ignorar */ }
    };

    es.onerror = () => {
      setSseConnected(false);
      es.close();
      esRef.current = null;
      reconnectTimerRef.current = setTimeout(() => {
        if (isLogged) connectRef.current?.();
      }, 5000);
    };
  }, [isLogged, onNewNotification]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!isLogged) {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      queueMicrotask(() => setSseConnected(false));
      return;
    }
    connect();
    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [isLogged, connect]);

  return { sseConnected };
}

/* ── Componente principal ──────────────────────────────────────────────── */
export default function Sininho({ token, count = 0, notifications = [], loading = false, onNavegar }) {
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [localNotifs, setLocalNotifs] = useState(notifications);
  const [localCount, setLocalCount] = useState(count);
  const [refreshing, setRefreshing] = useState(false);
  const wrapperRef = useRef(null);
  const prevCountRef = useRef(count);
  // Controla se já inicializamos com dados reais do servidor
  const initializedRef = useRef(notifications.length > 0);
  const isLogged = !!token;

  injectKeyframes();

  const emitirAtualizacaoPonto = useCallback((notif) => {
    if (notif?.tipo === "ponto") {
      window.dispatchEvent(new CustomEvent("nexus:ponto-atualizado", { detail: notif }));
    }
  }, []);

  // ── Sincronização com props externas ──────────────────────────────────
  // REGRA: o estado local é dono dos dados após a primeira inicialização.
  // A prop `notifications` só é aceita se:
  //   1) Ainda não inicializamos (primeira carga)
  //   2) O servidor trouxe mais notificações do que temos localmente
  //      (ex: outra aba aberta, polling de backup encontrou algo novo)
  useEffect(() => {
    if (!initializedRef.current && notifications.length > 0) {
      // Primeira carga com dados reais
      initializedRef.current = true;
      setLocalNotifs(notifications);
      setLocalCount(count);
    } else if (initializedRef.current && notifications.length > localNotifs.length) {
      // Servidor trouxe notificações a mais — merge sem perder as locais
      const idsLocais = new Set(localNotifs.map((n) => n.id));
      const novas = notifications.filter((n) => !idsLocais.has(n.id));
      novas.forEach(emitirAtualizacaoPonto);
      setLocalNotifs((prev) => {
        const idsAtuais = new Set(prev.map((n) => n.id));
        const novas = notifications.filter((n) => !idsAtuais.has(n.id));
        return novas.length > 0 ? [...novas, ...prev] : prev;
      });
    }
    // Em nenhum caso reduzimos a lista com base na prop — isso é feito só localmente
  }, [notifications, count]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count: só sobe via prop, nunca derruba (o sino controla a queda localmente)
  useEffect(() => {
    if (count > prevCountRef.current) {
      setLocalCount(count);
      setShaking(true);
      setTimeout(() => setShaking(false), 800);
    }
    prevCountRef.current = count;
  }, [count]);

  // ── SSE: nova notificação em tempo real ───────────────────────────────
  const handleNewNotification = useCallback((notif) => {
    initializedRef.current = true;
    emitirAtualizacaoPonto(notif);
    setLocalNotifs((prev) => {
      if (prev.some((n) => n.id === notif.id)) return prev;
      return [notif, ...prev];
    });
    setLocalCount((c) => c + 1);
    setShaking(true);
    setTimeout(() => setShaking(false), 800);
  }, [emitirAtualizacaoPonto]);

  const { sseConnected } = useSSENotifications({ isLogged, onNewNotification: handleNewNotification });

  // ── Fecha ao clicar fora ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // ── Abre IMEDIATAMENTE — marca lidas em background ────────────────────
  function handleOpen() {
    const wasOpen = open;
    setOpen((v) => !v); // síncrono, sem await — abre na hora

    if (!wasOpen && localCount > 0) {
      // Marca localmente de imediato
      setLocalNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
      setLocalCount(0);
      // Persiste no servidor em background
      axios
        .put(`${API_BASE}/notificacoes/marcar-todas-lidas`, {}, { headers: getAuthHeader() })
        .catch(() => {});
      // NÃO chama onRefresh aqui — evita o re-render que sobrescrevia a lista
    }
  }

  // ── Clica numa notificação — navega IMEDIATAMENTE ─────────────────────
  function handleClickNotif(notif) {
    setOpen(false);
    if (notif.tela && onNavegar) onNavegar(notif.tela); // navega primeiro, sem await

    if (!notif.lida) {
      setLocalNotifs((prev) => prev.map((n) => (n.id === notif.id ? { ...n, lida: true } : n)));
      axios
        .put(`${API_BASE}/notificacoes/${notif.id}/marcar-lida`, {}, { headers: getAuthHeader() })
        .catch(() => {});
    }
  }

  // ── Remover notificação ───────────────────────────────────────────────
  function handleDelete(e, notifId) {
    e.stopPropagation();
    setLocalNotifs((prev) => prev.filter((n) => n.id !== notifId));
    axios
      .delete(`${API_BASE}/notificacoes/${notifId}`, { headers: getAuthHeader() })
      .catch(() => {});
  }

  // ── Limpar todas ──────────────────────────────────────────────────────
  function handleClearAll() {
    setLocalNotifs([]);
    setLocalCount(0);
    axios
      .put(`${API_BASE}/notificacoes/marcar-todas-lidas`, {}, { headers: getAuthHeader() })
      .catch(() => {});
  }

  // ── Atualizar manualmente (botão ↻) ──────────────────────────────────
  async function handleManualRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const { data } = await axios.get(`${API_BASE}/notificacoes`, { headers: getAuthHeader() });
      const lista = data.notificacoes ?? data ?? [];
      setLocalNotifs(lista);
      initializedRef.current = true;
      const r = await axios.get(`${API_BASE}/notificacoes/nao-lidas-count`, { headers: getAuthHeader() });
      setLocalCount(r.data.count ?? 0);
    } catch { /* silencioso */ }
    finally { setRefreshing(false); }
  }

  const hasUnread = localCount > 0;
  const displayCount = localCount > 99 ? "99+" : localCount;
  const unreadInList = localNotifs.filter((n) => !n.lida).length;

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <button
        style={{ ...styles.bellBtn, background: open ? "rgba(0,200,255,0.1)" : "transparent" }}
        onClick={handleOpen}
        aria-label={`Notificações${hasUnread ? ` — ${displayCount} não lidas` : ""}`}
        title="Notificações"
      >
        <BellIcon hasUnread={hasUnread} shaking={shaking} />
        {hasUnread && <span style={styles.badge} aria-hidden="true">{displayCount}</span>}
      </button>

      {open && (
        <div style={styles.dropdown} role="dialog" aria-label="Painel de notificações">
          <div style={styles.header}>
            <span style={styles.headerTitle}>
              🔔 Notificações
              <span
                title={sseConnected ? "Tempo real ativo" : "Reconectando..."}
                style={{
                  width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                  background: sseConnected ? "#00e676" : "#ff9800",
                  animation: "ssePulse 2s ease-in-out infinite",
                  boxShadow: sseConnected ? "0 0 5px rgba(0,230,118,0.7)" : "0 0 5px rgba(255,152,0,0.7)",
                }}
              />
              {unreadInList > 0 && (
                <span style={{ background: "rgba(255,59,85,0.2)", color: "#ff8095", fontSize: "10px", borderRadius: "999px", padding: "1px 7px", fontWeight: "700" }}>
                  {unreadInList} nova(s)
                </span>
              )}
            </span>
            <div style={styles.headerActions}>
              {localNotifs.length > 0 && (
                <button style={styles.linkBtn} onClick={handleClearAll} title="Limpar todas">Limpar</button>
              )}
              <button
                style={{ ...styles.linkBtn, opacity: refreshing ? 0.5 : 1 }}
                onClick={handleManualRefresh}
                title="Atualizar agora"
                disabled={refreshing}
              >
                {refreshing ? "..." : "↻"}
              </button>
            </div>
          </div>

          <div style={styles.list}>
            {loading && localNotifs.length === 0 ? (
              <div style={styles.loadingRow}>Carregando...</div>
            ) : localNotifs.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>🔕</span>
                Nenhuma notificação por aqui.
              </div>
            ) : (
              localNotifs.map((notif) => (
                <div
                  key={notif.id}
                  style={styles.item(notif.lida)}
                  onClick={() => handleClickNotif(notif)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,200,255,0.07)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = notif.lida ? "transparent" : "rgba(0,200,255,0.04)"; }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleClickNotif(notif)}
                >
                  <span style={styles.itemIcon} aria-hidden="true">{tipoIcon(notif.tipo)}</span>
                  <div style={styles.itemContent}>
                    <div style={styles.itemMsg(notif.lida)}>{notif.mensagem}</div>
                    <div style={styles.itemTime}>
                      {timeAgo(notif.criada_em)}
                      {notif.tela && (
                        <span style={{ marginLeft: "8px", color: "#00c8ff", fontSize: "9px", letterSpacing: "0.5px" }}>→ ver mais</span>
                      )}
                    </div>
                  </div>
                  {!notif.lida && <span style={styles.unreadDot} aria-hidden="true" />}
                  <button
                    style={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, notif.id)}
                    title="Remover"
                    aria-label="Remover notificação"
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ff3b55")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#3a5570")}
                  >✕</button>
                </div>
              ))
            )}
          </div>

          {localNotifs.length > 0 && (
            <div style={styles.footer}>
              <span style={{ color: "#3a5570", fontSize: "11px", fontFamily: "var(--mono, monospace)" }}>
                {localNotifs.length} notificação(ões)
              </span>
              <span style={{ fontSize: "10px", fontFamily: "var(--mono, monospace)", color: sseConnected ? "#00e676" : "#ff9800", opacity: 0.8 }}>
                {sseConnected ? "● tempo real" : "● reconectando..."}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
