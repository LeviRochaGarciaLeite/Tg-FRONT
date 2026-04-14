/**
 * Sininho.jsx — Componente de notificações (sino) do Nexus
 *
 * Props:
 *   token          — JWT do usuário logado (usado nos headers)
 *   count          — número de notificações não lidas (badge)
 *   notifications  — array de objetos de notificação
 *   loading        — boolean indicando carregamento
 *   onRefresh      — callback para recarregar notificações
 *   onNavegar      — callback(aba) para navegar para a tela da notificação
 */

import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ── Ícone SVG do sino ─────────────────────────────────────────────────── */

function BellIcon({ hasUnread }) {
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
      }}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/* ── Ícone por tipo de notificação ─────────────────────────────────────── */

function tipoIcon(tipo) {
  const map = {
    equipe:   "👥",
    senha:    "🔑",
    holerite: "📄",
    ponto:    "🕐",
    perfil:   "✏️",
    conta:    "⚙️",
  };
  return map[tipo] || "🔔";
}

/* ── Formatar data relativa ────────────────────────────────────────────── */

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} dias`;
  return new Date(isoString).toLocaleDateString("pt-BR");
}

/* ── Estilos inline ────────────────────────────────────────────────────── */

const styles = {
  wrapper: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "6px 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    position: "relative",
    transition: "background 0.15s",
  },
  badge: {
    position: "absolute",
    top: "2px",
    right: "2px",
    minWidth: "16px",
    height: "16px",
    background: "#ff3b55",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: "700",
    fontFamily: "var(--mono, monospace)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 3px",
    lineHeight: 1,
    pointerEvents: "none",
    boxShadow: "0 0 8px rgba(255,59,85,0.7)",
    animation: "siNinhoPulse 1.8s ease-in-out infinite",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: "-8px",
    width: "340px",
    maxWidth: "95vw",
    background: "#111927",
    border: "1px solid #2a4060",
    borderRadius: "14px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.85)",
    zIndex: 9999,
    overflow: "hidden",
    animation: "siNinhoFadeSlide 0.18s ease",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 10px",
    borderBottom: "1px solid #1e2d42",
  },
  headerTitle: {
    fontFamily: "var(--display, Rajdhani, sans-serif)",
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#e8f4ff",
    textTransform: "uppercase",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#00c8ff",
    fontSize: "11px",
    fontFamily: "var(--display, Rajdhani, sans-serif)",
    fontWeight: "600",
    letterSpacing: "0.5px",
    padding: "2px 4px",
    borderRadius: "4px",
    transition: "opacity 0.15s",
  },
  list: {
    maxHeight: "360px",
    overflowY: "auto",
    padding: "6px 0",
  },
  emptyState: {
    textAlign: "center",
    padding: "36px 20px",
    color: "#3a5570",
    fontFamily: "var(--sans, 'Exo 2', sans-serif)",
    fontSize: "13px",
  },
  emptyIcon: {
    fontSize: "32px",
    marginBottom: "8px",
    display: "block",
    opacity: 0.5,
  },
  item: (lida) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    background: lida ? "transparent" : "rgba(0, 200, 255, 0.04)",
    borderBottom: "1px solid rgba(30,45,66,0.5)",
    transition: "background 0.15s",
    position: "relative",
  }),
  itemIcon: {
    fontSize: "18px",
    lineHeight: 1,
    flexShrink: 0,
    marginTop: "2px",
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemMsg: (lida) => ({
    fontSize: "12.5px",
    fontFamily: "var(--sans, 'Exo 2', sans-serif)",
    color: lida ? "#7a9bbf" : "#e8f4ff",
    fontWeight: lida ? "400" : "500",
    lineHeight: "1.45",
    wordBreak: "break-word",
  }),
  itemTime: {
    fontSize: "10px",
    color: "#3a5570",
    fontFamily: "var(--mono, monospace)",
    marginTop: "3px",
  },
  unreadDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#00c8ff",
    flexShrink: 0,
    marginTop: "5px",
    boxShadow: "0 0 5px rgba(0,200,255,0.6)",
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#3a5570",
    fontSize: "14px",
    padding: "2px 4px",
    borderRadius: "4px",
    flexShrink: 0,
    lineHeight: 1,
    transition: "color 0.15s",
  },
  footer: {
    borderTop: "1px solid #1e2d42",
    padding: "10px 14px",
    display: "flex",
    justifyContent: "center",
  },
  loadingRow: {
    textAlign: "center",
    padding: "24px",
    color: "#3a5570",
    fontFamily: "var(--mono, monospace)",
    fontSize: "12px",
  },
};

/* ── Keyframes injetados uma vez ───────────────────────────────────────── */

const KEYFRAMES = `
@keyframes siNinhoPulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.18); }
}
@keyframes siNinhoFadeSlide {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes siNinhoBell {
  0%,100%  { transform: rotate(0deg); }
  10%,30%  { transform: rotate(-12deg); }
  20%,40%  { transform: rotate(12deg); }
  50%      { transform: rotate(0deg); }
}
`;

let keyframesInjected = false;

function injectKeyframes() {
  if (keyframesInjected) return;
  const style = document.createElement("style");
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
  keyframesInjected = true;
}

/* ── Componente principal ──────────────────────────────────────────────── */

export default function Sininho({
  token,
  count = 0,
  notifications = [],
  loading = false,
  onRefresh,
  onNavegar,
}) {
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [localNotifs, setLocalNotifs] = useState(notifications);
  const wrapperRef = useRef(null);
  const prevCount = useRef(count);

  injectKeyframes();

  // Sync com props externas
  useEffect(() => {
    setLocalNotifs(notifications);
  }, [notifications]);

  // Anima o sino quando chega nova notificação
  useEffect(() => {
    if (count > prevCount.current) {
      setShaking(true);
      setTimeout(() => setShaking(false), 800);
    }
    prevCount.current = count;
  }, [count]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Marca todas como lidas ao abrir (somente se houver não lidas)
  async function handleOpen() {
    const wasOpen = open;
    setOpen((v) => !v);

    if (!wasOpen && count > 0) {
      try {
        await axios.put(
          `${API_BASE}/notificacoes/marcar-todas-lidas`,
          {},
          { headers: getAuthHeader() }
        );
        // Atualiza local
        setLocalNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
        onRefresh?.();
      } catch {
        // silencioso — não impede a abertura
      }
    }
  }

  // Marca uma notificação como lida e navega para a tela
  async function handleClickNotif(notif) {
    if (!notif.lida) {
      try {
        await axios.put(
          `${API_BASE}/notificacoes/${notif.id}/marcar-lida`,
          {},
          { headers: getAuthHeader() }
        );
        setLocalNotifs((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, lida: true } : n))
        );
        onRefresh?.();
      } catch {
        // silencioso
      }
    }

    if (notif.tela && onNavegar) {
      setOpen(false);
      onNavegar(notif.tela);
    }
  }

  // Remove notificação
  async function handleDelete(e, notifId) {
    e.stopPropagation();
    try {
      await axios.delete(`${API_BASE}/notificacoes/${notifId}`, {
        headers: getAuthHeader(),
      });
      setLocalNotifs((prev) => prev.filter((n) => n.id !== notifId));
      onRefresh?.();
    } catch {
      // silencioso
    }
  }

  // Limpar todas
  async function handleClearAll() {
    try {
      // Marca todas como lidas primeiro
      await axios.put(
        `${API_BASE}/notificacoes/marcar-todas-lidas`,
        {},
        { headers: getAuthHeader() }
      );
      // Remove cada uma localmente (sem recarregar)
      setLocalNotifs([]);
      onRefresh?.();
    } catch {
      // silencioso
    }
  }

  const hasUnread = count > 0;
  const displayCount = count > 99 ? "99+" : count;

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      {/* ── Botão do sino ── */}
      <button
        style={{
          ...styles.bellBtn,
          background: open ? "rgba(0,200,255,0.1)" : "transparent",
          animation: shaking ? "siNinhoBell 0.8s ease" : "none",
        }}
        onClick={handleOpen}
        aria-label={`Notificações${hasUnread ? ` — ${displayCount} não lidas` : ""}`}
        title="Notificações"
      >
        <BellIcon hasUnread={hasUnread} />

        {hasUnread && (
          <span style={styles.badge} aria-hidden="true">
            {displayCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={styles.dropdown} role="dialog" aria-label="Painel de notificações">
          {/* Cabeçalho */}
          <div style={styles.header}>
            <span style={styles.headerTitle}>
              🔔 Notificações
              {localNotifs.filter((n) => !n.lida).length > 0 && (
                <span
                  style={{
                    marginLeft: "8px",
                    background: "rgba(255,59,85,0.2)",
                    color: "#ff8095",
                    fontSize: "10px",
                    borderRadius: "999px",
                    padding: "1px 7px",
                    fontWeight: "700",
                  }}
                >
                  {localNotifs.filter((n) => !n.lida).length} nova(s)
                </span>
              )}
            </span>

            <div style={styles.headerActions}>
              {localNotifs.length > 0 && (
                <button
                  style={styles.linkBtn}
                  onClick={handleClearAll}
                  title="Limpar todas"
                >
                  Limpar
                </button>
              )}
              <button
                style={styles.linkBtn}
                onClick={() => { onRefresh?.(); }}
                title="Atualizar"
              >
                ↻
              </button>
            </div>
          </div>

          {/* Lista */}
          <div style={styles.list}>
            {loading ? (
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0,200,255,0.07)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notif.lida
                      ? "transparent"
                      : "rgba(0,200,255,0.04)";
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleClickNotif(notif)}
                >
                  {/* Ícone do tipo */}
                  <span style={styles.itemIcon} aria-hidden="true">
                    {tipoIcon(notif.tipo)}
                  </span>

                  {/* Conteúdo */}
                  <div style={styles.itemContent}>
                    <div style={styles.itemMsg(notif.lida)}>
                      {notif.mensagem}
                    </div>
                    <div style={styles.itemTime}>
                      {timeAgo(notif.criada_em)}
                      {notif.tela && (
                        <span
                          style={{
                            marginLeft: "8px",
                            color: "#00c8ff",
                            fontSize: "9px",
                            letterSpacing: "0.5px",
                          }}
                        >
                          → ver mais
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ponto de não lida */}
                  {!notif.lida && <span style={styles.unreadDot} aria-hidden="true" />}

                  {/* Botão deletar */}
                  <button
                    style={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, notif.id)}
                    title="Remover"
                    aria-label="Remover notificação"
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ff3b55")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#3a5570")}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Rodapé */}
          {localNotifs.length > 0 && (
            <div style={styles.footer}>
              <span style={{ color: "#3a5570", fontSize: "11px", fontFamily: "var(--mono, monospace)" }}>
                {localNotifs.length} notificação(ões)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
