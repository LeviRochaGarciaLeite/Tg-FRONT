import { useState, useEffect, useCallback } from "react";
import axios from "axios";

// ─── Constantes ───────────────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:5000/api";
const DIA_PAGAMENTO = 8;

function getAuthHeader() {
  const token = localStorage.getItem("nexus_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Holerite ─────────────────────────────────────────────────────────────────
export default function Holerite({ userData = {} }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [okConfirmado, setOkConfirmado] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  const hoje = new Date();
  const mesCompetencia = hoje.getDate() < DIA_PAGAMENTO
    ? (hoje.getMonth() === 0 ? 12 : hoje.getMonth())
    : hoje.getMonth() + 1;
  const anoCompetencia = hoje.getDate() < DIA_PAGAMENTO && hoje.getMonth() === 0
    ? hoje.getFullYear() - 1
    : hoje.getFullYear();

  // ── Buscar dados do backend ────────────────────────────────────────────────
  const buscarDados = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const { data } = await axios.get(`${API_BASE}/holerite/dados`, {
        headers: getAuthHeader(),
        params: { mes: mesCompetencia, ano: anoCompetencia },
      });
      setDados(data);
    } catch (e) {
      setErro(e.response?.data?.erro || "Não foi possível carregar o holerite.");
    } finally {
      setLoading(false);
    }
  }, [mesCompetencia, anoCompetencia]);

  useEffect(() => { buscarDados(); }, [buscarDados]);

  // ── Gerar PDF com jsPDF ───────────────────────────────────────────────────
  const gerarPdf = useCallback(async () => {
    if (!dados) return;
    setGerandoPdf(true);

    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const mg = 18;

    const cor = {
      azul:    [10, 20, 40],
      ciano:   [0, 180, 220],
      ouro:    [220, 175, 0],
      branco:  [232, 244, 255],
      cinzaCl: [160, 190, 215],
      cinzaMd: [80, 110, 140],
      cinzaEsc:[20, 35, 55],
      linha:   [30, 55, 80],
      verde:   [0, 200, 120],
      vermelho:[220, 50, 70],
    };

    const fmt = (v) =>
      `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    const setFill = (c) => doc.setFillColor(...c);
    const setDraw = (c) => doc.setDrawColor(...c);
    const setTxt  = (c) => doc.setTextColor(...c);
    const rect    = (x, y, w, h, s = "F") => doc.rect(x, y, w, h, s);
    const line    = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2);

    // ── CABEÇALHO ──────────────────────────────────────────────────────────
    setFill(cor.azul); rect(0, 0, W, 38);
    setFill(cor.ciano); rect(0, 0, W, 2.5);

    setTxt(cor.ciano);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("NE\u2736US", mg, 16);

    setTxt(cor.cinzaCl);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("SISTEMA DE GESTÃO DE PONTO", mg, 22);

    setTxt(cor.branco);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("HOLERITE / CONTRACHEQUE", W / 2, 16, { align: "center" });

    setTxt(cor.ouro);
    doc.setFontSize(9);
    doc.text(`COMPETÊNCIA: ${dados.competencia.descricao.toUpperCase()}`, W / 2, 23, { align: "center" });

    setTxt(cor.cinzaCl);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("DATA DE PAGAMENTO", W - mg, 13, { align: "right" });
    setTxt(cor.ciano);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(dados.pagamento.data, W - mg, 20, { align: "right" });

    setTxt(cor.cinzaMd);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `DOC Nº ${String(dados.colaborador.empresa_id).padStart(4,"0")}-${anoCompetencia}${String(mesCompetencia).padStart(2,"0")}`,
      W - mg, 27, { align: "right" }
    );

    // ── COLABORADOR ────────────────────────────────────────────────────────
    let y = 46;
    setFill(cor.cinzaEsc); rect(mg, y, W - mg * 2, 26, "F");
    setFill(cor.ciano);    rect(mg, y, 3, 26, "F");

    setTxt(cor.cinzaCl);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("COLABORADOR", mg + 6, y + 6);
    setTxt(cor.branco);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(dados.colaborador.nome.toUpperCase(), mg + 6, y + 14);
    setTxt(cor.cinzaCl);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`CPF: ${dados.colaborador.cpf}`, mg + 6, y + 21);

    setTxt(cor.cinzaCl);
    doc.setFontSize(7);
    doc.text("CARGO / FUNÇÃO", W - mg - 50, y + 6);
    setTxt(cor.ciano);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(dados.colaborador.cargo.toUpperCase(), W - mg - 50, y + 14);
    setTxt(cor.cinzaCl);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Empresa ID: ${dados.colaborador.empresa_id}`, W - mg - 50, y + 21);

    // ── FREQUÊNCIA ─────────────────────────────────────────────────────────
    y += 34;
    setTxt(cor.ouro);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("FREQUÊNCIA DO MÊS", mg, y);
    setDraw(cor.ouro); doc.setLineWidth(0.4);
    line(mg, y + 1.5, mg + 55, y + 1.5);

    y += 6;
    setFill(cor.cinzaEsc); rect(mg, y, W - mg * 2, 7, "F");
    setTxt(cor.ciano);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const colX = [mg + 3, mg + 30, mg + 55, mg + 80, mg + 110, mg + 140];
    ["DATA", "ENTRADA", "SAÍDA", "PAUSAS", "HORAS TRAB.", "STATUS"].forEach((h, i) =>
      doc.text(h, colX[i], y + 4.5)
    );

    y += 7;
    const rowH = 6.5;
    dados.frequencia.detalhes_dias.forEach((dia, idx) => {
      const bg = idx % 2 === 0 ? [15, 28, 45] : [12, 22, 36];
      setFill(bg); rect(mg, y, W - mg * 2, rowH, "F");

      const dataFmt = new Date(dia.data + "T12:00:00").toLocaleDateString("pt-BR");
      const extra = dia.horas > 8;
      const incompleto = dia.horas > 0 && dia.horas < 4;
      const status = dia.horas === 0 ? "SEM REG." : incompleto ? "INCOMPLETO" : extra ? "HORA EXTRA" : "OK";

      setTxt(cor.cinzaCl);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(dataFmt,              colX[0], y + 4.3);
      doc.text(dia.entrada,          colX[1], y + 4.3);
      doc.text(dia.saida,            colX[2], y + 4.3);
      doc.text(String(dia.pausas),   colX[3], y + 4.3);

      setTxt(extra ? cor.verde : incompleto ? cor.vermelho : cor.cinzaCl);
      doc.text(`${dia.horas.toFixed(2)}h`, colX[4], y + 4.3);

      setTxt(status === "OK" ? cor.verde : status === "HORA EXTRA" ? cor.ouro : status === "INCOMPLETO" ? cor.vermelho : cor.cinzaMd);
      doc.setFont("helvetica", "bold");
      doc.text(status, colX[5], y + 4.3);

      y += rowH;

      if (y > H - 60) {
        doc.addPage();
        setFill(cor.azul); rect(0, 0, W, 10);
        setFill(cor.ciano); rect(0, 0, W, 1.5);
        y = 18;
      }
    });

    y += 3;
    setFill(cor.cinzaEsc); rect(mg, y, W - mg * 2, 8, "F");
    setTxt(cor.ciano);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(
      `DIAS TRABALHADOS: ${dados.frequencia.dias_trabalhados}   TOTAL DE HORAS: ${dados.frequencia.total_horas.toFixed(2)}h   HORAS EXTRAS: ${dados.frequencia.horas_extras.toFixed(2)}h`,
      mg + 4, y + 5
    );

    // ── VENCIMENTOS E DESCONTOS ────────────────────────────────────────────
    y += 16;
    const colMeio = W / 2;

    setTxt(cor.verde);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("VENCIMENTOS", mg, y);
    setDraw(cor.verde); doc.setLineWidth(0.4);
    line(mg, y + 1.5, mg + 45, y + 1.5);

    setTxt(cor.vermelho);
    doc.text("DESCONTOS", colMeio + 2, y);
    setDraw(cor.vermelho);
    line(colMeio + 2, y + 1.5, colMeio + 40, y + 1.5);

    y += 7;

    const vencimentos = [
      { desc: "Salário Base",       val: dados.financeiro.salario_base },
      { desc: "Horas Extras (50%)", val: dados.financeiro.horas_extras_valor },
      { desc: "Vale Refeição",      val: dados.financeiro.vale_refeicao },
    ];
    const descontos = [
      { desc: "INSS (7,5%)",           val: dados.financeiro.descontos.inss },
      { desc: "IRRF (7,5%)",           val: dados.financeiro.descontos.irrf },
      { desc: "Vale Transporte (6%)",  val: dados.financeiro.descontos.vale_transporte },
    ];

    const maxRows = Math.max(vencimentos.length, descontos.length);
    for (let i = 0; i < maxRows; i++) {
      const bg = i % 2 === 0 ? [15, 28, 45] : [12, 22, 36];
      setFill(bg);
      rect(mg,          y, colMeio - mg - 2, 7, "F");
      rect(colMeio + 2, y, colMeio - mg - 2, 7, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);

      if (vencimentos[i]) {
        setTxt(cor.cinzaCl);
        doc.text(vencimentos[i].desc, mg + 3, y + 4.5);
        setTxt(cor.verde);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(vencimentos[i].val), colMeio - mg - 4, y + 4.5, { align: "right" });
      }
      if (descontos[i]) {
        setTxt(cor.cinzaCl);
        doc.setFont("helvetica", "normal");
        doc.text(descontos[i].desc, colMeio + 5, y + 4.5);
        setTxt(cor.vermelho);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(descontos[i].val), W - mg - 2, y + 4.5, { align: "right" });
      }
      y += 7;
    }

    y += 1;
    setFill(cor.cinzaEsc);
    rect(mg,          y, colMeio - mg - 2, 8, "F");
    rect(colMeio + 2, y, colMeio - mg - 2, 8, "F");

    setTxt(cor.verde);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("TOTAL VENCIMENTOS", mg + 3, y + 5.2);
    doc.text(fmt(dados.financeiro.total_vencimentos), colMeio - mg - 4, y + 5.2, { align: "right" });

    setTxt(cor.vermelho);
    doc.text("TOTAL DESCONTOS", colMeio + 5, y + 5.2);
    doc.text(fmt(dados.financeiro.descontos.total_descontos), W - mg - 2, y + 5.2, { align: "right" });

    // ── SALÁRIO LÍQUIDO ────────────────────────────────────────────────────
    y += 15;
    setFill(cor.ciano); rect(mg, y, W - mg * 2, 14, "F");
    setTxt(cor.azul);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SALÁRIO LÍQUIDO A RECEBER", mg + 6, y + 5.5);
    doc.setFontSize(16);
    doc.text(fmt(dados.financeiro.salario_liquido), W - mg - 4, y + 9.5, { align: "right" });

    // ── RODAPÉ ─────────────────────────────────────────────────────────────
    y += 22;
    setDraw(cor.linha); doc.setLineWidth(0.3);
    line(mg, y, W - mg, y);
    setTxt(cor.cinzaMd);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const geradoEm = new Date().toLocaleString("pt-BR");
    doc.text(`Documento gerado em: ${geradoEm}   |   Este holerite é um documento eletrônico do sistema Nexus.`, W / 2, y + 5, { align: "center" });
    doc.text("Em caso de dúvidas, entre em contato com o departamento de Recursos Humanos.", W / 2, y + 10, { align: "center" });
    setFill(cor.ciano); rect(0, H - 2, W, 2, "F");

    const blob = doc.output("blob");
    const url  = URL.createObjectURL(blob);
    setPdfBlob(blob);
    setPdfUrl(url);
    setGerandoPdf(false);
  }, [dados, mesCompetencia, anoCompetencia]);

  useEffect(() => {
    if (dados && !pdfUrl) gerarPdf();
  }, [dados, pdfUrl, gerarPdf]);

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  // ── Confirmar recebimento ──────────────────────────────────────────────────
  async function handleOk() {
    setConfirmando(true);
    try {
      await axios.post(
        `${API_BASE}/holerite/confirmar`,
        { mes: mesCompetencia, ano: anoCompetencia },
        { headers: getAuthHeader() }
      );
    } catch { /* ignora erro de rede */ } finally {
      setOkConfirmado(true);
      setShowModal(false);
      setConfirmando(false);
    }
  }

  function handleDownload() {
    if (!pdfBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(pdfBlob);
    a.download = `holerite-${dados?.competencia?.mes_nome?.toLowerCase()}-${anoCompetencia}.pdf`;
    a.click();
  }

  const primeiroNome = (dados?.colaborador?.nome || userData?.nome || "Colaborador").split(" ")[0];

  const dataProxPgto = new Date(hoje.getFullYear(), hoje.getMonth(), DIA_PAGAMENTO);
  if (dataProxPgto < hoje) dataProxPgto.setMonth(dataProxPgto.getMonth() + 1);
  const dataPgtoFmt = dataProxPgto.toLocaleDateString("pt-BR");

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        .hl-wrap {
          padding:28px 32px 48px; display:flex; flex-direction:column; gap:22px;
          max-width:980px; margin:0 auto; animation:hlFade .4s ease both;
        }
        @keyframes hlFade { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

        .hl-greeting {
          background:var(--bg-panel,#0d1422); border:1px solid var(--border-hi,#2a4060);
          border-radius:var(--radius,8px); padding:28px 32px; position:relative; overflow:hidden;
        }
        .hl-greeting::before {
          content:''; position:absolute; top:0;left:0;right:0; height:2px;
          background:linear-gradient(90deg,var(--accent-gold,#ffcc00),var(--accent-cyan,#00c8ff),transparent);
        }
        .hl-tag { font-family:var(--mono,'Share Tech Mono',monospace); font-size:10px; letter-spacing:.18em; color:var(--text-lo,#3a5570); text-transform:uppercase; margin-bottom:8px; }
        .hl-title { font-family:var(--display,'Rajdhani',sans-serif); font-size:28px; font-weight:700; color:var(--text-hi,#e8f4ff); line-height:1.2; margin-bottom:6px; }
        .hl-title span { color:var(--accent-cyan,#00c8ff); }
        .hl-subtitle { font-family:var(--sans,'Exo 2',sans-serif); font-size:14px; color:var(--text-mid,#7a9bbf); line-height:1.5; }
        .hl-subtitle strong { color:var(--accent-gold,#ffcc00); }
        .hl-status-row { display:flex; align-items:center; gap:10px; margin-top:18px; flex-wrap:wrap; }
        .hl-badge { display:inline-flex; align-items:center; gap:7px; padding:5px 14px; border-radius:20px; font-family:var(--mono,'Share Tech Mono',monospace); font-size:10px; letter-spacing:.12em; }
        .hl-badge.pend { background:rgba(255,59,85,.1); border:1px solid rgba(255,59,85,.35); color:var(--accent-red,#ff3b55); }
        .hl-badge.ok   { background:rgba(0,232,122,.1); border:1px solid rgba(0,232,122,.35); color:var(--accent-green,#00e87a); }
        .hl-badge.info { border:1px solid var(--border-hi,#2a4060); color:var(--text-mid,#7a9bbf); }
        .hl-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0; }
        .hl-dot.pend { background:var(--accent-red,#ff3b55); animation:hlBlink 1.2s infinite; }
        .hl-dot.ok   { background:var(--accent-green,#00e87a); box-shadow:0 0 6px rgba(0,232,122,.8); }
        @keyframes hlBlink { 0%,100%{opacity:1}50%{opacity:.3} }

        .hl-viewer { background:var(--bg-panel,#0d1422); border:1px solid var(--border,#1e2d42); border-radius:var(--radius,8px); overflow:hidden; }
        .hl-viewer-bar { display:flex; align-items:center; justify-content:space-between; padding:10px 18px; background:var(--bg-card2,#0f1720); border-bottom:1px solid var(--border,#1e2d42); }
        .hl-viewer-name { font-family:var(--mono,'Share Tech Mono',monospace); font-size:11px; letter-spacing:.14em; color:var(--text-mid,#7a9bbf); }
        .btn-dl { display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:transparent;border:1px solid var(--border-hi,#2a4060);border-radius:6px;color:var(--text-mid,#7a9bbf);font-family:var(--display,'Rajdhani',sans-serif);font-size:11px;font-weight:600;letter-spacing:.1em;cursor:pointer;transition:all .2s; }
        .btn-dl:hover { border-color:var(--accent-cyan,#00c8ff);color:var(--accent-cyan,#00c8ff); }
        .hl-iframe { width:100%;height:560px;border:none;display:block;background:#111; }
        .hl-pdf-loading { height:560px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px; }
        .hl-spinner { width:40px;height:40px;border:3px solid rgba(0,200,255,.15);border-top-color:var(--accent-cyan,#00c8ff);border-radius:50%;animation:spin .8s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .hl-pdf-loading p { font-family:var(--mono,'Share Tech Mono',monospace);font-size:11px;letter-spacing:.14em;color:var(--text-mid,#7a9bbf); }

        .hl-footer { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap; }
        .hl-footer-info { font-family:var(--sans,'Exo 2',sans-serif);font-size:12px;color:var(--text-lo,#3a5570);line-height:1.5;max-width:500px; }
        .btn-ok { display:inline-flex;align-items:center;gap:10px;padding:14px 32px;background:transparent;border:1px solid var(--accent-cyan,#00c8ff);border-radius:var(--radius,8px);color:var(--accent-cyan,#00c8ff);font-family:var(--display,'Rajdhani',sans-serif);font-size:15px;font-weight:700;letter-spacing:.18em;cursor:pointer;position:relative;overflow:hidden;transition:all .2s;white-space:nowrap; }
        .btn-ok::before { content:'';position:absolute;inset:0;background:var(--accent-cyan,#00c8ff);opacity:0;transition:opacity .2s; }
        .btn-ok:hover::before { opacity:.08; }
        .btn-ok:hover { box-shadow:0 0 20px rgba(0,200,255,.25);transform:translateY(-1px); }
        .btn-ok:disabled { opacity:.4;cursor:default;pointer-events:none; }
        .btn-ok.done { border-color:var(--accent-green,#00e87a);color:var(--accent-green,#00e87a);pointer-events:none; }

        .hl-overlay { position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:9999;animation:hlFade .2s; }
        .hl-modal { background:var(--bg-panel,#0d1422);border:1px solid var(--border-hi,#2a4060);border-radius:12px;padding:36px 32px;max-width:420px;width:90%;position:relative;animation:hlSlide .25s ease; }
        @keyframes hlSlide { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .hl-modal::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent-cyan,#00c8ff),var(--accent-gold,#ffcc00));border-radius:12px 12px 0 0; }
        .hl-modal-icon { width:56px;height:56px;border-radius:50%;background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.25);display:flex;align-items:center;justify-content:center;margin:0 auto 20px; }
        .hl-modal h3 { font-family:var(--display,'Rajdhani',sans-serif);font-size:20px;font-weight:700;letter-spacing:.1em;color:var(--text-hi,#e8f4ff);text-align:center;margin-bottom:10px; }
        .hl-modal p  { font-family:var(--sans,'Exo 2',sans-serif);font-size:13px;color:var(--text-mid,#7a9bbf);text-align:center;line-height:1.6;margin-bottom:28px; }
        .hl-modal p strong { color:var(--accent-gold,#ffcc00); }
        .hl-modal-row { display:flex;gap:12px; }
        .btn-cancel { flex:1;padding:12px;background:transparent;border:1px solid var(--border-hi,#2a4060);border-radius:var(--radius,8px);color:var(--text-mid,#7a9bbf);font-family:var(--display,'Rajdhani',sans-serif);font-size:14px;font-weight:600;letter-spacing:.1em;cursor:pointer;transition:all .2s; }
        .btn-cancel:hover { border-color:var(--accent-red,#ff3b55);color:var(--accent-red,#ff3b55); }
        .btn-confirm { flex:2;padding:12px;background:var(--accent-cyan,#00c8ff);border:none;border-radius:var(--radius,8px);color:#000;font-family:var(--display,'Rajdhani',sans-serif);font-size:14px;font-weight:700;letter-spacing:.14em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s; }
        .btn-confirm:hover { background:#33d6ff;box-shadow:0 0 20px rgba(0,200,255,.4); }
        .btn-confirm:disabled { opacity:.6;cursor:default; }
        .mini-spin { width:16px;height:16px;border:2px solid rgba(0,0,0,.3);border-top-color:#000;border-radius:50%;animation:spin .7s linear infinite; }
        .hl-error { padding:40px;text-align:center;font-family:var(--sans,'Exo 2',sans-serif);color:var(--accent-red,#ff3b55); }
        .hl-error button { margin-top:16px;padding:10px 24px;background:transparent;border:1px solid var(--accent-red,#ff3b55);border-radius:6px;color:var(--accent-red,#ff3b55);font-family:var(--display,'Rajdhani',sans-serif);font-size:13px;letter-spacing:.1em;cursor:pointer; }
      `}</style>

      <div className="hl-wrap">

        {/* Saudação */}
        <div className="hl-greeting">
          <div className="hl-tag">Holerite Digital</div>
          <div className="hl-title">Olá, <span>{primeiroNome}</span>!</div>
          <div className="hl-subtitle">
            Esse é o seu holerite do dia <strong>{dataPgtoFmt}</strong>.{" "}
            Revise as informações no PDF e confirme o recebimento.
          </div>
          <div className="hl-status-row">
            <div className={`hl-badge ${okConfirmado ? "ok" : "pend"}`}>
              <span className={`hl-dot ${okConfirmado ? "ok" : "pend"}`} />
              {okConfirmado ? "RECEBIMENTO CONFIRMADO" : "AGUARDANDO SUA CONFIRMAÇÃO"}
            </div>
            {dados && (
              <div className="hl-badge info">
                Competência: {dados.competencia.descricao}
              </div>
            )}
          </div>
        </div>

        {/* Erro */}
        {erro && !loading && (
          <div className="hl-error">
            <p>{erro}</p>
            <button onClick={buscarDados}>TENTAR NOVAMENTE</button>
          </div>
        )}

        {/* Viewer */}
        {!erro && (
          <div className="hl-viewer">
            <div className="hl-viewer-bar">
              <span className="hl-viewer-name">
                📄 holerite-{dados?.competencia?.mes_nome?.toLowerCase() ?? "..."}-{anoCompetencia}.pdf
              </span>
              <div style={{ display:"flex", gap:"8px" }}>
                {pdfUrl && (
                  <button className="btn-dl" onClick={handleDownload}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    BAIXAR PDF
                  </button>
                )}
              </div>
            </div>

            {loading || gerandoPdf || !pdfUrl ? (
              <div className="hl-pdf-loading">
                <div className="hl-spinner" />
                <p>{loading ? "CARREGANDO DADOS..." : "GERANDO HOLERITE..."}</p>
              </div>
            ) : (
              <iframe className="hl-iframe" src={pdfUrl} title="Holerite PDF" />
            )}
          </div>
        )}

        {/* Footer */}
        {!erro && (
          <div className="hl-footer">
            <p className="hl-footer-info">
              Após revisar todas as informações, confirme o recebimento do holerite.
              Essa ação fica registrada no sistema.
            </p>
            {!okConfirmado ? (
              <button className="btn-ok" onClick={() => setShowModal(true)} disabled={!pdfUrl}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Confirmar Recebimento
              </button>
            ) : (
              <button className="btn-ok done">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Recebimento Confirmado
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="hl-overlay" onClick={() => !confirmando && setShowModal(false)}>
          <div className="hl-modal" onClick={e => e.stopPropagation()}>
            <div className="hl-modal-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan,#00c8ff)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <h3>Confirmar Recebimento</h3>
            <p>
              Você está confirmando o recebimento do holerite referente a{" "}
              <strong>{dados?.competencia?.descricao}</strong>, no valor líquido de{" "}
              <strong>
                R$ {dados
                  ? Number(dados.financeiro.salario_liquido).toLocaleString("pt-BR", { minimumFractionDigits:2 })
                  : "..."}
              </strong>.
            </p>
            <div className="hl-modal-row">
              <button className="btn-cancel" onClick={() => setShowModal(false)} disabled={confirmando}>
                CANCELAR
              </button>
              <button className="btn-confirm" onClick={handleOk} disabled={confirmando}>
                {confirmando
                  ? <><div className="mini-spin" /> CONFIRMANDO...</>
                  : <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      CONFIRMAR
                    </>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
