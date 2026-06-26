import type jsPDF from "jspdf";

const COLORS = {
  primary: [30, 64, 175] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  warning: [202, 138, 4] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  bg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightBg: [241, 245, 249] as [number, number, number],
};

function formatCurrency(v: number): string {
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface ConsultorStats {
  nome?: string;
  negocios: number;
  valorTotal: number;
  ganhos: number;
  perdidos: number;
  emAndamento: number;
  visitasCRM: number;
  taxaConversao: number;
  visitas: number;
  eficiencia: number;
}

interface ReportStats {
  individual?: string;
  periodo: { inicio: string; fim: string };
  totais: ConsultorStats;
  consultores: ConsultorStats[];
}

interface ReportAnalise {
  nome?: string;
  classificacao?: string;
  analise?: string;
  pontos_fortes?: string[];
  pontos_fracos?: string[];
}

interface ConsultoresReport {
  _stats: ReportStats;
  resumo_executivo?: {
    visao_geral?: string;
    destaques_positivos?: string[];
    destaques_negativos?: string[];
    conclusoes?: string[];
  };
  analise_consultores?: ReportAnalise[];
  pontos_atencao?: { severidade?: string; titulo: string; descricao: string }[];
  oportunidades?: { titulo: string; descricao: string }[];
  insights_ia?: {
    padroes?: string[];
    tendencias?: string[];
    previsoes?: string[];
  };
  recomendacoes?: { prioridade?: string; titulo: string; descricao: string }[];
  plano_acao?: {
    acoes_gestor?: string[];
    acoes_consultores?: string[];
    prioridades_curto_prazo?: string[];
  };
}

export async function generateConsultoresReport(report: ConsultoresReport) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  const stats = report._stats;
  const periodo = stats.periodo;
  const totais = stats.totais;
  const consultores = stats.consultores;

  function checkPage(needed: number) {
    if (y + needed > 275) {
      pdf.addPage();
      y = 15;
    }
  }

  function sectionTitle(icon: string, title: string) {
    checkPage(18);
    y += 6;
    pdf.setFillColor(...COLORS.primary);
    pdf.roundedRect(marginL, y, contentW, 10, 2, 2, "F");
    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${icon}  ${title}`, marginL + 4, y + 7);
    y += 14;
    pdf.setTextColor(...COLORS.dark);
  }

  function paragraph(text: string, indent = 0) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.dark);
    const lines = pdf.splitTextToSize(text, contentW - indent);
    for (const line of lines) {
      checkPage(5);
      pdf.text(line, marginL + indent, y);
      y += 4.2;
    }
    y += 1;
  }

  function bulletList(items: string[], color = COLORS.dark) {
    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "normal");
    for (const item of items) {
      const lines = pdf.splitTextToSize(item, contentW - 8);
      checkPage(lines.length * 4 + 2);
      pdf.setTextColor(...color);
      pdf.text("•", marginL + 3, y);
      for (let i = 0; i < lines.length; i++) {
        pdf.text(lines[i], marginL + 7, y);
        y += 4;
      }
      y += 0.5;
    }
    y += 2;
    pdf.setTextColor(...COLORS.dark);
  }

  // ===== COVER =====
  const isIndividual = !!stats.individual;
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pageW, 70, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text(isIndividual ? "Relatório Individual de Performance" : "Relatório de Performance Comercial", pageW / 2, 28, { align: "center" });
  pdf.setFontSize(14);
  pdf.text(isIndividual ? stats.individual : "Consultores", pageW / 2, 38, { align: "center" });
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Período: ${formatDate(periodo.inicio)} a ${formatDate(periodo.fim)} (últimos 30 dias)`, pageW / 2, 50, { align: "center" });
  const now = new Date();
  pdf.text(`Emissão: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageW / 2, 57, { align: "center" });

  y = 78;

  // ===== KPI BOXES =====
  const kpis = [
    { label: "Negócios", value: String(totais.negocios), color: COLORS.primary },
    { label: "Volume Total", value: formatCurrency(totais.valorTotal), color: COLORS.success },
    { label: "Ganhos", value: String(totais.ganhos), color: COLORS.success },
    { label: "Perdidos", value: String(totais.perdidos), color: COLORS.danger },
    { label: "Em Andamento", value: String(totais.emAndamento), color: COLORS.warning },
    { label: "Visitas CRM", value: String(totais.visitasCRM), color: COLORS.primary },
  ];

  const kpiW = (contentW - 10) / 3;
  for (let i = 0; i < kpis.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = marginL + col * (kpiW + 5);
    const ky = y + row * 20;
    pdf.setFillColor(...COLORS.lightBg);
    pdf.roundedRect(x, ky, kpiW, 16, 2, 2, "F");
    pdf.setFillColor(...kpis[i].color);
    pdf.roundedRect(x, ky, 2, 16, 1, 0, "F");
    pdf.setTextColor(...kpis[i].color);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(kpis[i].value, x + 6, ky + 7);
    pdf.setTextColor(...COLORS.muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(kpis[i].label, x + 6, ky + 12);
  }
  y += 45;

  // ===== RANKING TABLE =====
  checkPage(40);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.dark);
  pdf.text("Ranking de Consultores (Top 10)", marginL, y);
  y += 5;

  const headers = ["#", "Consultor", "Negócios", "Volume", "Ganhos", "Conv.%", "Visitas", "Efic.%"];
  const colW = [8, 40, 18, 28, 16, 16, 16, 16];
  // Header
  pdf.setFillColor(...COLORS.primary);
  pdf.roundedRect(marginL, y, contentW, 7, 1, 1, "F");
  pdf.setTextColor(...COLORS.white);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  let cx = marginL + 2;
  for (let i = 0; i < headers.length; i++) {
    pdf.text(headers[i], cx, y + 5);
    cx += colW[i];
  }
  y += 8;

  const top10 = consultores.slice(0, 10);
  for (let ri = 0; ri < top10.length; ri++) {
    const c = top10[ri];
    checkPage(7);
    if (ri % 2 === 0) {
      pdf.setFillColor(...COLORS.lightBg);
      pdf.rect(marginL, y - 1, contentW, 6, "F");
    }
    pdf.setTextColor(...COLORS.dark);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    cx = marginL + 2;
    const medals = ["🥇", "🥈", "🥉"];
    const rank = ri < 3 ? medals[ri] : `${ri + 1}`;
    const vals = [rank, c.nome?.split(" ").slice(0, 2).join(" ") || "", String(c.negocios), formatCurrency(c.valorTotal), String(c.ganhos), `${c.taxaConversao}%`, String(c.visitas), `${c.eficiencia}%`];
    for (let i = 0; i < vals.length; i++) {
      pdf.text(vals[i].slice(0, colW[i] / 2 + 5), cx, y + 3);
      cx += colW[i];
    }
    y += 6;
  }
  y += 5;

  // ===== SECTION 1: RESUMO EXECUTIVO =====
  const re = report.resumo_executivo;
  sectionTitle("📊", "1. RESUMO EXECUTIVO");
  if (re?.visao_geral) paragraph(re.visao_geral);
  if (re?.destaques_positivos?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("Destaques Positivos:", marginL, y); y += 5;
    bulletList(re.destaques_positivos, COLORS.success);
  }
  if (re?.destaques_negativos?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("Destaques Negativos:", marginL, y); y += 5;
    bulletList(re.destaques_negativos, COLORS.danger);
  }
  if (re?.conclusoes?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("Conclusões:", marginL, y); y += 5;
    bulletList(re.conclusoes);
  }

  // ===== SECTION 2: ANÁLISE POR CONSULTOR =====
  sectionTitle("👨‍💼", "2. ANÁLISE DE PERFORMANCE DOS CONSULTORES");
  const analise = report.analise_consultores || [];
  for (const c of analise) {
    checkPage(25);
    const classColor = c.classificacao === "Alta performance" ? COLORS.success : c.classificacao === "Baixa performance" ? COLORS.danger : COLORS.warning;
    pdf.setFillColor(...COLORS.lightBg);
    pdf.roundedRect(marginL, y, contentW, 7, 1, 1, "F");
    pdf.setFillColor(...classColor);
    pdf.roundedRect(marginL, y, 2, 7, 1, 0, "F");
    pdf.setTextColor(...COLORS.dark);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(c.nome || "", marginL + 5, y + 5);
    pdf.setTextColor(...classColor);
    pdf.setFontSize(7);
    pdf.text(c.classificacao || "", marginL + contentW - 5 - pdf.getTextWidth(c.classificacao || ""), y + 5);
    y += 10;
    if (c.analise) paragraph(c.analise, 2);
    if (c.pontos_fortes?.length) {
      pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(...COLORS.success); pdf.text("Pontos Fortes:", marginL + 2, y); y += 4;
      bulletList(c.pontos_fortes, COLORS.success);
    }
    if (c.pontos_fracos?.length) {
      pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(...COLORS.danger); pdf.text("Pontos Fracos:", marginL + 2, y); y += 4;
      bulletList(c.pontos_fracos, COLORS.danger);
    }
  }

  // ===== SECTION 3: PONTOS DE ATENÇÃO =====
  sectionTitle("⚠️", "3. PONTOS DE ATENÇÃO");
  for (const p of (report.pontos_atencao || [])) {
    checkPage(12);
    const sevColor = p.severidade === "alta" ? COLORS.danger : p.severidade === "media" ? COLORS.warning : COLORS.muted;
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.setTextColor(...sevColor);
    pdf.text(`[${(p.severidade || "").toUpperCase()}] ${p.titulo}`, marginL + 2, y);
    y += 4.5;
    paragraph(p.descricao, 2);
  }

  // ===== SECTION 4: OPORTUNIDADES =====
  sectionTitle("💡", "4. OPORTUNIDADES IDENTIFICADAS");
  for (const o of (report.oportunidades || [])) {
    checkPage(12);
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.setTextColor(...COLORS.primary);
    pdf.text(o.titulo, marginL + 2, y); y += 4.5;
    pdf.setTextColor(...COLORS.dark);
    paragraph(o.descricao, 2);
  }

  // ===== SECTION 5: INSIGHTS IA =====
  sectionTitle("🧠", "5. INSIGHTS INTELIGENTES (IA)");
  const ins = report.insights_ia;
  if (ins?.padroes?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("Padrões Identificados:", marginL, y); y += 5;
    bulletList(ins.padroes, COLORS.primary);
  }
  if (ins?.tendencias?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("Tendências:", marginL, y); y += 5;
    bulletList(ins.tendencias, COLORS.warning);
  }
  if (ins?.previsoes?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("Projeções (próximos 30 dias):", marginL, y); y += 5;
    bulletList(ins.previsoes);
  }

  // ===== SECTION 6: RECOMENDAÇÕES =====
  sectionTitle("🎯", "6. RECOMENDAÇÕES ESTRATÉGICAS");
  for (const r of (report.recomendacoes || [])) {
    checkPage(12);
    const prColor = r.prioridade === "alta" ? COLORS.danger : r.prioridade === "media" ? COLORS.warning : COLORS.muted;
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.setTextColor(...prColor);
    pdf.text(`[${(r.prioridade || "").toUpperCase()}] ${r.titulo}`, marginL + 2, y);
    y += 4.5;
    pdf.setTextColor(...COLORS.dark);
    paragraph(r.descricao, 2);
  }

  // ===== SECTION 7: PLANO DE AÇÃO =====
  sectionTitle("📲", "7. PLANO DE AÇÃO");
  const pa = report.plano_acao;
  if (pa?.acoes_gestor?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("Ações para o Gestor:", marginL, y); y += 5;
    bulletList(pa.acoes_gestor, COLORS.primary);
  }
  if (pa?.acoes_consultores?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("Ações para os Consultores:", marginL, y); y += 5;
    bulletList(pa.acoes_consultores);
  }
  if (pa?.prioridades_curto_prazo?.length) {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.setTextColor(...COLORS.danger); pdf.text("Prioridades de Curto Prazo (7-30 dias):", marginL, y); y += 5;
    bulletList(pa.prioridades_curto_prazo, COLORS.danger);
  }

  // Footer on each page
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`Relatório de Performance Comercial - Consultores | Período: ${formatDate(periodo.inicio)} a ${formatDate(periodo.fim)}`, marginL, 290);
    pdf.text(`Página ${i}/${totalPages}`, pageW - marginR, 290, { align: "right" });
  }

  const suffix = isIndividual ? stats.individual.replace(/\s+/g, "_") : "Consultores";
  pdf.save(`Relatorio_${suffix}_${periodo.fim}.pdf`);
}
