/**
 * Chat.jsx — Sistema de mensagens em tempo real — Nexus
 * Usa socket.io-client para WebSocket com Flask-SocketIO
 *
 * IMPORTANTE: Antes de usar, instale a dependência no frontend:
 *   npm install socket.io-client
 */

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const API_BASE    = "http://127.0.0.1:5000/api";
const SOCKET_URL  = "http://127.0.0.1:5000";

function getToken() {
  return localStorage.getItem("nexus_token") || "";
}

function getAuthHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function getUserId() {
  try {
    const payload = JSON.parse(atob(getToken().split(".")[1]));
    return parseInt(payload.sub);
  } catch {
    return null;
  }
}

function fmtHora(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtData(isoStr) {
  if (!isoStr) return "";
  const d    = new Date(isoStr);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}

const PERFIL_LABEL = { colaborador:"COLABORADOR", supervisor:"SUPERVISOR", gestor:"GESTOR", admin:"ADMIN" };
const PERFIL_COLOR = { colaborador:"#7a9bbf", supervisor:"#ffcc00", gestor:"#00c8ff", admin:"#00e87a" };

function AvatarChat({ foto, nome, size = 38, badge = 0 }) {
  const initials = nome ? nome.split(" ").slice(0,2).map(p=>p[0]).join("").toUpperCase() : "?";
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius:"50%",
        background:"linear-gradient(135deg,#182a3e,#111927)",
        border:"1.5px solid #1e2d42",
        display:"flex", alignItems:"center", justifyContent:"center",
        overflow:"hidden", fontSize:size*0.36,
        fontFamily:"var(--display)", fontWeight:700, color:"#7a9bbf", letterSpacing:0.5,
      }}>
        {foto ? <img src={foto} alt={nome} style={{width:"100%",height:"100%",objectFit:"cover"}}/> : initials}
      </div>
      {badge > 0 && (
        <div style={{
          position:"absolute", top:-3, right:-3,
          background:"#ff3b55", color:"white",
          borderRadius:"50%", width:17, height:17,
          fontSize:10, fontFamily:"var(--display)", fontWeight:700,
          display:"flex", alignItems:"center", justifyContent:"center",
          border:"2px solid #0d1422", zIndex:2,
        }}>
          {badge > 9 ? "9+" : badge}
        </div>
      )}
    </div>
  );
}

function IconeChat({ unread = 0 }) {
  return (
    <div style={{position:"relative"}}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {unread > 0 && (
        <div style={{
          position:"absolute", top:-5, right:-5,
          background:"#ff3b55", color:"white",
          borderRadius:"50%", width:16, height:16,
          fontSize:9, fontFamily:"var(--display)", fontWeight:700,
          display:"flex", alignItems:"center", justifyContent:"center",
          border:"2px solid #0d1422",
        }}>
          {unread > 9 ? "9+" : unread}
        </div>
      )}
    </div>
  );
}

function DotConectado({ conectado }) {
  return (
    <div style={{
      width:7, height:7, borderRadius:"50%", flexShrink:0,
      background: conectado ? "#00e87a" : "#ff3b55",
      boxShadow: conectado ? "0 0 6px #00e87a" : "none",
      transition:"all 0.3s",
    }} title={conectado ? "Conectado em tempo real" : "Reconectando..."}/>
  );
}

export default function Chat({ userData }) {
  const [aberto,          setAberto]          = useState(false);
  const [contatos,        setContatos]        = useState([]);
  const [contatoAtivo,    setContatoAtivo]    = useState(null);
  const [mensagens,       setMensagens]       = useState([]);
  const [texto,           setTexto]           = useState("");
  const [enviando,        setEnviando]        = useState(false);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [loadingMsgs,     setLoadingMsgs]     = useState(false);
  const [totalNaoLidas,   setTotalNaoLidas]   = useState(0);
  const [wsConectado,     setWsConectado]     = useState(false);
  const [hoverPreview,    setHoverPreview]    = useState({ visible:false, contato:null, x:0, y:0 });

  const hoverTimerRef = useRef(null);
  const msgEndRef     = useRef(null);
  const inputRef      = useRef(null);
  const socketRef     = useRef(null);
  const contatoRef    = useRef(null);
  const meId          = getUserId();

  useEffect(() => { contatoRef.current = contatoAtivo; }, [contatoAtivo]);

  const carregarContatos = useCallback(async () => {
    setLoadingContatos(true);
    try {
      const { data } = await axios.get(`${API_BASE}/chat/contatos`, { headers: getAuthHeader() });
      setContatos(data.contatos || []);
      const total = (data.contatos || []).reduce((s,c) => s + (c.nao_lidas||0), 0);
      setTotalNaoLidas(total);
    } catch(e) { console.warn("Erro contatos:", e); }
    finally { setLoadingContatos(false); }
  }, []);

  const carregarNaoLidas = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/chat/nao-lidas-count`, { headers: getAuthHeader() });
      setTotalNaoLidas(data.count || 0);
    } catch {}
  }, []);

  // WebSocket — inicializa uma vez
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setWsConectado(true);
      socket.emit("autenticar", { token: getToken() });
    });

    socket.on("disconnect", () => setWsConectado(false));

    socket.on("autenticado", () => {
      carregarNaoLidas();
      carregarContatos();
    });

    socket.on("erro_auth", (d) => console.warn("WS auth error:", d.msg));

    socket.on("nova_mensagem", (msg) => {
      const ativo = contatoRef.current;
      if (ativo && msg.remetente_id === ativo.id) {
        setMensagens(prev => [...prev, msg]);
        socket.emit("marcar_lidas", { outro_id: msg.remetente_id });
        carregarContatos();
      } else {
        setTotalNaoLidas(n => n + 1);
        setContatos(prev => prev.map(c =>
          c.id === msg.remetente_id
            ? { ...c, nao_lidas:(c.nao_lidas||0)+1, ultima_mensagem:msg }
            : c
        ));
      }
    });

    socket.on("mensagem_enviada", (msg) => {
      setMensagens(prev => prev.map(m => (m.temp ? msg : m)));
      setContatos(prev => prev.map(c =>
        c.id === msg.destinatario_id ? { ...c, ultima_mensagem:msg } : c
      ));
    });

    socket.on("mensagens_lidas", ({ ids }) => {
      setMensagens(prev => prev.map(m => (ids.includes(m.id) ? { ...m, lida:true } : m)));
    });

    return () => socket.disconnect();
  }, []); // eslint-disable-line

  useEffect(() => {
    carregarNaoLidas();
    const iv = setInterval(carregarNaoLidas, 30000);
    return () => clearInterval(iv);
  }, [carregarNaoLidas]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [mensagens]);

  const selecionarContato = async (contato) => {
    setContatoAtivo(contato);
    setMensagens([]);
    setLoadingMsgs(true);
    try {
      const { data } = await axios.get(`${API_BASE}/chat/mensagens/${contato.id}`, { headers: getAuthHeader() });
      setMensagens(data.mensagens || []);
      socketRef.current?.emit("marcar_lidas", { outro_id: contato.id });
      setContatos(prev => prev.map(c => c.id === contato.id ? { ...c, nao_lidas:0 } : c));
      setTotalNaoLidas(n => Math.max(0, n - (contato.nao_lidas||0)));
    } catch(e) { console.warn("Erro mensagens:", e); }
    finally { setLoadingMsgs(false); }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const enviarMensagem = () => {
    if (!texto.trim() || !contatoAtivo || !socketRef.current?.connected) return;
    const textoEnviar = texto.trim();
    setTexto("");
    const msgTemp = {
      id: `temp_${Date.now()}`,
      remetente_id: meId,
      destinatario_id: contatoAtivo.id,
      texto: textoEnviar,
      lida: false,
      criada_em: new Date().toISOString(),
      temp: true,
    };
    setMensagens(prev => [...prev, msgTemp]);
    socketRef.current.emit("enviar_mensagem", { destinatario_id: contatoAtivo.id, texto: textoEnviar });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }
  };

  const handleMouseEnterContato = (e, contato) => {
    const rect = e.currentTarget.getBoundingClientRect();
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoverPreview({ visible:true, contato, x:rect.right+10, y:rect.top });
    }, 350);
  };

  const handleMouseLeaveContato = () => {
    clearTimeout(hoverTimerRef.current);
    setHoverPreview({ visible:false, contato:null, x:0, y:0 });
  };

  const grupos = [];
  let ultimaData = null;
  for (const msg of mensagens) {
    const d = fmtData(msg.criada_em);
    if (d !== ultimaData) { grupos.push({ type:"sep", d }); ultimaData = d; }
    grupos.push({ type:"msg", msg });
  }

  return (
    <>
      <style>{`
        @keyframes chatIn { from{opacity:0;transform:translateY(10px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .nx-contato:hover { background:rgba(0,200,255,.05) !important; }
        .nx-input:focus   { outline:none; border-color:#00c8ff !important; box-shadow:0 0 0 2px rgba(0,200,255,.12) !important; }
        .nx-scroll::-webkit-scrollbar{width:4px} .nx-scroll::-webkit-scrollbar-track{background:transparent}
        .nx-scroll::-webkit-scrollbar-thumb{background:#1e2d42;border-radius:4px}
        .nx-send:hover:not(:disabled){filter:brightness(1.15);transform:scale(1.05)} .nx-send{transition:all .15s}
      `}</style>

      {/* Botão flutuante */}
      <button onClick={() => { const n=!aberto; setAberto(n); if(n) carregarContatos(); }}
        style={{
          position:"fixed", bottom:28, right:28, width:52, height:52, borderRadius:"50%",
          background: aberto ? "linear-gradient(135deg,rgba(0,200,255,.15),rgba(26,111,255,.15))" : "linear-gradient(135deg,#0d1422,#111927)",
          border:`1.5px solid ${aberto?"#00c8ff":"#1e2d42"}`,
          color: aberto?"#00c8ff":"#7a9bbf", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:10000, transition:"all 0.2s ease",
          boxShadow: aberto?"0 0 20px rgba(0,200,255,.25)":"0 4px 20px rgba(0,0,0,.5)",
        }}>
        <IconeChat unread={totalNaoLidas}/>
      </button>

      {/* Painel */}
      {aberto && (
        <div style={{
          position:"fixed", bottom:92, right:28, width:360, height:530,
          background:"#0d1422", border:"1px solid #1e2d42", borderRadius:12,
          boxShadow:"0 16px 64px rgba(0,0,0,.75), 0 0 0 1px rgba(0,200,255,.04)",
          display:"flex", flexDirection:"column", overflow:"hidden",
          zIndex:9999, animation:"chatIn 0.18s ease",
        }}>

          {/* Header */}
          <div style={{
            padding:"12px 15px", borderBottom:"1px solid #1e2d42",
            background:"#090e17", display:"flex", alignItems:"center",
            gap:10, flexShrink:0,
          }}>
            {contatoAtivo ? (
              <>
                <button onClick={() => { setContatoAtivo(null); setMensagens([]); }}
                  style={{ background:"transparent", border:"none", color:"#7a9bbf", cursor:"pointer", fontSize:20, padding:"0 4px 0 0", lineHeight:1, flexShrink:0 }}>
                  ‹
                </button>
                <AvatarChat foto={contatoAtivo.foto_perfil} nome={contatoAtivo.nome} size={32}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"var(--display)", fontSize:14, fontWeight:700, color:"#e8f4ff", letterSpacing:.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {contatoAtivo.nome}
                  </div>
                  <div style={{ fontSize:10, fontFamily:"var(--display)", fontWeight:600, color:PERFIL_COLOR[contatoAtivo.perfil]||"#7a9bbf", letterSpacing:1 }}>
                    {PERFIL_LABEL[contatoAtivo.perfil]||contatoAtivo.perfil?.toUpperCase()}
                  </div>
                </div>
                <DotConectado conectado={wsConectado}/>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{color:"#00c8ff",flexShrink:0}}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontFamily:"var(--display)", fontSize:12, fontWeight:700, color:"#e8f4ff", letterSpacing:2, flex:1 }}>MENSAGENS</span>
                <DotConectado conectado={wsConectado}/>
                {totalNaoLidas > 0 && (
                  <div style={{ background:"#ff3b55", color:"white", borderRadius:10, padding:"1px 7px", fontSize:10, fontFamily:"var(--display)", fontWeight:700 }}>
                    {totalNaoLidas}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Conversa */}
          {contatoAtivo ? (
            <>
              <div className="nx-scroll" style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:2 }}>
                {loadingMsgs && (
                  <div style={{ textAlign:"center", color:"#3a5570", fontSize:12, padding:24 }}>Carregando conversa...</div>
                )}
                {!loadingMsgs && mensagens.length === 0 && (
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8, color:"#3a5570", marginTop:60 }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize:11, fontFamily:"var(--display)", letterSpacing:1 }}>Nenhuma mensagem ainda</span>
                    <span style={{ fontSize:10, fontFamily:"var(--sans)", opacity:.5 }}>Diga olá para {contatoAtivo.nome.split(" ")[0]} 👋</span>
                  </div>
                )}

                {grupos.map((item, idx) => {
                  if (item.type === "sep") return (
                    <div key={`s${idx}`} style={{ textAlign:"center", fontSize:10, color:"#3a5570", fontFamily:"var(--display)", letterSpacing:1, margin:"8px 0 4px" }}>
                      — {item.d} —
                    </div>
                  );
                  const { msg } = item;
                  const isMe = msg.remetente_id === meId;
                  return (
                    <div key={msg.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", marginBottom:3 }}>
                      {!isMe && (
                        <div style={{ marginRight:6, marginTop:"auto" }}>
                          <AvatarChat foto={msg.remetente_foto||contatoAtivo.foto_perfil} nome={msg.remetente_nome||contatoAtivo.nome} size={24}/>
                        </div>
                      )}
                      <div style={{
                        maxWidth:"72%",
                        background: isMe ? "linear-gradient(135deg,#0d2a4a,#112240)" : "#111927",
                        border: isMe ? "1px solid #1a4070" : "1px solid #1e2d42",
                        borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                        padding:"8px 11px", opacity:msg.temp?0.65:1, transition:"opacity .2s",
                      }}>
                        <div style={{ fontSize:13, color:isMe?"#c8e0f5":"#a8c0d8", fontFamily:"var(--sans)", lineHeight:1.45, wordBreak:"break-word" }}>
                          {msg.texto}
                        </div>
                        <div style={{ fontSize:9, color:"#3a5570", fontFamily:"var(--mono)", marginTop:3, textAlign:"right", display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4 }}>
                          {fmtHora(msg.criada_em)}
                          {isMe && (
                            <span style={{ color:msg.lida?"#00c8ff":"#3a5570", transition:"color .3s", fontFamily:"var(--sans)" }}>
                              {msg.temp ? "⏳" : msg.lida ? "✓✓" : "✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef}/>
              </div>

              {/* Input */}
              <div style={{ padding:"10px 12px", borderTop:"1px solid #1e2d42", background:"#090e17", display:"flex", gap:8, alignItems:"flex-end", flexShrink:0, position:"relative" }}>
                {!wsConectado && (
                  <div style={{
                    position:"absolute", bottom:68, left:12, right:12,
                    background:"rgba(255,59,85,.12)", border:"1px solid rgba(255,59,85,.3)",
                    borderRadius:6, padding:"5px 10px", fontSize:10, color:"#ff3b55",
                    fontFamily:"var(--display)", letterSpacing:.8, textAlign:"center",
                  }}>
                    ⚠ Reconectando ao servidor...
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  className="nx-input"
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={wsConectado ? "Digite uma mensagem... (Enter para enviar)" : "Aguardando conexão..."}
                  disabled={!wsConectado}
                  rows={1}
                  style={{
                    flex:1, background:wsConectado?"#111927":"#0d1422",
                    border:"1px solid #1e2d42", borderRadius:8,
                    color:"#e8f4ff", fontFamily:"var(--sans)", fontSize:13,
                    padding:"8px 11px", resize:"none", lineHeight:1.45,
                    maxHeight:90, overflowY:"auto",
                    transition:"border-color .2s, box-shadow .2s",
                    opacity:wsConectado?1:0.5,
                  }}
                  onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,90)+"px"; }}
                />
                <button
                  className="nx-send"
                  onClick={enviarMensagem}
                  disabled={!texto.trim() || !wsConectado}
                  style={{
                    width:36, height:36, borderRadius:8,
                    background: texto.trim()&&wsConectado ? "linear-gradient(135deg,#00c8ff,#1a6fff)" : "#111927",
                    border:`1px solid ${texto.trim()&&wsConectado?"#00c8ff":"#1e2d42"}`,
                    color: texto.trim()&&wsConectado?"#fff":"#3a5570",
                    cursor: texto.trim()&&wsConectado?"pointer":"not-allowed",
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                  }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </>
          ) : (
            /* Lista de contatos */
            <div className="nx-scroll" style={{ flex:1, overflowY:"auto" }}>
              {loadingContatos && (
                <div style={{ textAlign:"center", color:"#3a5570", fontSize:12, padding:28 }}>Carregando contatos...</div>
              )}
              {!loadingContatos && contatos.length === 0 && (
                <div style={{ textAlign:"center", color:"#3a5570", fontSize:12, padding:36, fontFamily:"var(--display)", letterSpacing:1 }}>Nenhum contato disponível</div>
              )}
              {contatos.map(contato => (
                <div key={contato.id} className="nx-contato"
                  onClick={() => selecionarContato(contato)}
                  onMouseEnter={e => handleMouseEnterContato(e, contato)}
                  onMouseLeave={handleMouseLeaveContato}
                  style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #0f1720", background:"transparent", transition:"background .15s" }}>
                  <AvatarChat foto={contato.foto_perfil} nome={contato.nome} size={40} badge={contato.nao_lidas}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                      <span style={{ fontFamily:"var(--display)", fontSize:13, fontWeight:contato.nao_lidas>0?700:600, color:contato.nao_lidas>0?"#e8f4ff":"#9ab6cc", letterSpacing:.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flex:1, minWidth:0 }}>
                        {contato.nome}
                      </span>
                      {contato.ultima_mensagem && (
                        <span style={{ fontSize:9, color:"#3a5570", fontFamily:"var(--mono)", flexShrink:0 }}>
                          {fmtHora(contato.ultima_mensagem.criada_em)}
                        </span>
                      )}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:9, color:PERFIL_COLOR[contato.perfil]||"#3a5570", fontFamily:"var(--display)", letterSpacing:1, fontWeight:700, flexShrink:0 }}>
                        {PERFIL_LABEL[contato.perfil]||""}
                      </span>
                      {contato.ultima_mensagem && (
                        <>
                          <span style={{ color:"#2a3f55", fontSize:10 }}>·</span>
                          <span style={{ fontSize:11, color:contato.nao_lidas>0?"#7a9bbf":"#3a5570", fontFamily:"var(--sans)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flex:1, fontWeight:contato.nao_lidas>0?600:400 }}>
                            {contato.ultima_mensagem.remetente_id===meId ? "Você: " : ""}
                            {contato.ultima_mensagem.texto.length>28 ? contato.ultima_mensagem.texto.slice(0,28)+"…" : contato.ultima_mensagem.texto}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hover preview tooltip */}
      {hoverPreview.visible && hoverPreview.contato && (
        <div style={{
          position:"fixed", left:hoverPreview.x, top:hoverPreview.y,
          zIndex:10001, background:"#0d1422", border:"1px solid #1e2d42",
          borderRadius:10, padding:"12px 14px", minWidth:210,
          boxShadow:"0 8px 32px rgba(0,0,0,.75)",
          pointerEvents:"none", animation:"chatIn 0.15s ease",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <AvatarChat foto={hoverPreview.contato.foto_perfil} nome={hoverPreview.contato.nome} size={34} badge={hoverPreview.contato.nao_lidas}/>
            <div>
              <div style={{ fontFamily:"var(--display)", fontSize:13, fontWeight:700, color:"#e8f4ff", letterSpacing:.5 }}>{hoverPreview.contato.nome}</div>
              <div style={{ fontSize:10, fontFamily:"var(--display)", fontWeight:600, color:PERFIL_COLOR[hoverPreview.contato.perfil]||"#7a9bbf", letterSpacing:1 }}>
                {PERFIL_LABEL[hoverPreview.contato.perfil]||""}
              </div>
            </div>
          </div>
          {hoverPreview.contato.ultima_mensagem && (
            <div style={{ fontSize:11, color:"#7a9bbf", fontFamily:"var(--sans)", borderTop:"1px solid #1e2d42", paddingTop:8 }}>
              <div style={{ fontSize:9, color:"#3a5570", fontFamily:"var(--mono)", marginBottom:3, letterSpacing:.5 }}>ÚLTIMA MENSAGEM</div>
              {hoverPreview.contato.ultima_mensagem.texto.length>55 ? hoverPreview.contato.ultima_mensagem.texto.slice(0,55)+"…" : hoverPreview.contato.ultima_mensagem.texto}
            </div>
          )}
          <div style={{ marginTop:10, fontSize:9, color:"#00c8ff", fontFamily:"var(--display)", letterSpacing:1, display:"flex", alignItems:"center", gap:4 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            CLIQUE PARA ABRIR O CHAT
          </div>
        </div>
      )}
    </>
  );
}
