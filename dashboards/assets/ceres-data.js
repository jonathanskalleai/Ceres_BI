/* ============================================================
   Ceres BI — Data loader
   Carrega dados do Supabase (mirror schema) e expõe
   window.CERES_DATA + window.CERES_DATA_READY (Promise).
   Fallback para mock data se Supabase indisponível.
   ============================================================ */

(function () {

  // ── Mock data (fallback) ─────────────────────────────────────────────────

  const MOCK = {
    admin: {
      totalClientes: 850,
      ativos: 680,
      prospects: 170,
      ufs: 12,
      consultores: 8,
      empresas: 320,
      carteiraPorConsultor: [
        { label: "Ana Paula",     value: 142 },
        { label: "Carlos Melo",   value: 118 },
        { label: "Fernanda Lima", value: 97  },
        { label: "João Silva",    value: 89  },
        { label: "Maria Costa",   value: 76  },
        { label: "Pedro Santos",  value: 68  },
        { label: "Renata Alves",  value: 55  },
        { label: "Outros",        value: 205 },
      ],
      classificacao: [
        { label: "Cliente",       value: 580 },
        { label: "Prospect",      value: 170 },
        { label: "Inativo",       value: 65  },
        { label: "Lead",          value: 35  },
      ],
      ufsCobertura: [
        { label: "SP", value: 210 },
        { label: "RJ", value: 145 },
        { label: "MG", value: 98  },
        { label: "PR", value: 87  },
        { label: "RS", value: 72  },
        { label: "SC", value: 65  },
        { label: "BA", value: 54  },
        { label: "DF", value: 43  },
      ],
    },

    comercial: {
      totalNegocios: 120, ganhos: 45, perdidos: 30, andamento: 45,
      taxaConversao: 60, pipelineAberto: 850000, valorGanho: 1200000,
      ticketMedioGanho: 26666, cicloMedioDias: 42, esforcoMedio: 5.2,
      funilPorEtapa: [
        { label: "3-PROPOSTA",     value: 400000, qtd: 12 },
        { label: "4-NEGOCIAÇÃO",   value: 280000, qtd: 8  },
        { label: "2-QUALIFICAÇÃO", value: 170000, qtd: 25 },
      ],
      porOrigem: [
        { label: "Indicação",   ganhos: 20, perdidos: 10, andamento: 15 },
        { label: "Prospecção",  ganhos: 15, perdidos: 12, andamento: 18 },
      ],
      motivosPerda: [
        { label: "Preço",        value: 180000, qtd: 8 },
        { label: "Concorrência", value: 120000, qtd: 5 },
      ],
      evolucaoMensal: [
        { name: "2025-01", novos: 12, valorCriado: 280000 },
        { name: "2025-02", novos: 15, valorCriado: 320000 },
      ],
      rankingConsultor: [
        { label: "João Silva",  value: 420000, ganhos: 12, total: 20, taxa: 60 },
        { label: "Maria Costa", value: 310000, ganhos: 9,  total: 18, taxa: 50 },
      ],
    },

    pedidos: {
      totalPedidos: 95, faturamentoAprovado: 2800000, ticketMedio: 35000,
      taxaAprovacao: 72, pctFinanciado: 45, valorCancelado: 120000,
      evolucaoMensal:  [{ name: "2025-01", faturamento: 280000, qtd: 8 }],
      mixPagamento:    [{ label: "Recurso Próprio", value: 1540000 }, { label: "Financiado", value: 1260000 }],
      porSituacao:     [{ label: "APROVADO", value: 2800000, qtd: 68 }, { label: "CANCELADO", value: 120000, qtd: 4 }],
      porVendedor:     [{ label: "João Silva", value: 520000 }, { label: "Maria Costa", value: 380000 }],
      porCidade:       [{ label: "São Paulo/SP", value: 680000 }, { label: "Curitiba/PR", value: 420000 }],
      porGrupo:        [{ label: "EQUIPAMENTOS", value: 1200000, qtd: 45 }, { label: "SERVIÇOS", value: 800000, qtd: 30 }],
    },

    operacional: {
      totalOS: 340, osAbertas: 82, taxaFechamento: 75.9,
      tempoMedioResolucao: 4.2, medianaResolucao: 2.8, totalOcorrencias: 512,
      tecnicosAtivos: 12, kmRodado: 18400, utilizacaoMedia: 68.4, tempoOcioso: 18.2,
      porStatus: [
        { label: "Encerrada", value: 258 },
        { label: "Aberta",    value: 82  },
      ],
      faixasResolucao: [
        { label: "0-1d",   value: 85 },
        { label: "2-3d",   value: 72 },
        { label: "4-7d",   value: 58 },
        { label: "8-15d",  value: 28 },
        { label: "16-30d", value: 12 },
        { label: "+30d",   value: 3  },
      ],
      evolucaoAberturas: [
        { name: "2025-01", value: 28 },
        { name: "2025-02", value: 32 },
      ],
      situacaoOcorrencias: [
        { label: "Concluída",  value: 380 },
        { label: "Em aberto",  value: 90  },
        { label: "Cancelada",  value: 42  },
      ],
      motivosPausa:      [{ label: "Sem peça", value: 18 }, { label: "Cliente ausente", value: 12 }],
      causasAtendimento: [{ label: "Manutenção preventiva", value: 142 }, { label: "Correção de defeito", value: 98 }],
      utilizacaoPorTecnico: [
        { label: "Técnico A", atendimento: 45, deslocamento: 25, ocioso: 30 },
        { label: "Técnico B", atendimento: 55, deslocamento: 20, ocioso: 25 },
      ],
      kmPorTecnico: [
        { label: "Técnico A", value: 2200 },
        { label: "Técnico B", value: 1900 },
      ],
    },

    produtos: {
      maquinasInstaladas: 1250, clientesComParque: 320, grupos: 8, marcas: 15,
      porGrupo:   [{ name: "Costureira", value: 480 }, { name: "Bordadeira", value: 320 }, { name: "Overlock", value: 250 }],
      porMarca:   [{ label: "Juki", value: 380 }, { label: "Brother", value: 290 }, { label: "Siruba", value: 210 }],
      topModelos: [{ label: "DDL-8700", value: 140 }, { label: "LK-1900", value: 98 }],
    },

    acoes: {
      totalAcoes: 1840, cidades: 87, consultores: 12, visitas: 620,
      clientes: 310, tiposAcaoDistintos: 7,
      porVendedor:    [{ label: "João Silva", value: 280 }, { label: "Maria Costa", value: 210 }],
      evolucaoMensal: [{ name: "2025-01", value: 142 }, { name: "2025-02", value: 168 }],
      porCidade:      [{ label: "São Paulo", value: 320 }, { label: "Curitiba", value: 180 }],
      porTipoAcao:    [{ name: "Visita", value: 620 }, { name: "Ligação", value: 480 }, { name: "Email", value: 340 }],
      porDiaSemana:   [
        { name: "Seg", value: 380 }, { name: "Ter", value: 420 }, { name: "Qua", value: 390 },
        { name: "Qui", value: 350 }, { name: "Sex", value: 280 }, { name: "Sáb", value: 18 }, { name: "Dom", value: 2 },
      ],
      porTipoContato: [{ name: "Presencial", value: 680 }, { name: "Telefone", value: 520 }, { name: "Remoto", value: 340 }],
      listaAnos: ["2024", "2025"],
      listaVendedores: ["João Silva", "Maria Costa"],
      tiposAcao: ["Visita", "Ligação", "Email"],
      listaCidades: ["São Paulo", "Curitiba"],
    },

    crm: {
      kpis: { totalRegistros: 1840, totalClientes: 310, totalConsultores: 8, totalPipeline: 850000, totalVisitas: 620, totalCidades: 87 },
      vendedores: [],
      regioes: [],
      evolucaoGlobal: [],
      tiposContato: { "Presencial": 680, "Telefone": 520, "Remoto": 340 },
      tiposAcao: { "Visita": 620, "Ligação": 480, "Email": 340 },
      registrosRecentes: [],
      listaVendedores: [],
      listaCidades: [],
    },

    negociosMensais: {
      totalNegocios: 120, totalValor: 1800000, ticketMedio: 15000,
      ganhos: 45, emAndamento: 45, perdidos: 30,
      taxaConversao: 60, clientesAtendidos: 75,
      totalRecebido: 950000, totalUsado: 250000, percentUsado: 13.9,
      evolucaoMensal: [], porConsultor: [], porRegiao: [], registros: [],
    },
  };

  // ── Nav (lida pelo layout.js para montar sidebar) ────────────────────────

  const NAV = [
    {
      group: "COMERCIAL CRM",
      items: [
        { id: "overview",         href: "overview.html",         label: "Visão Geral",      num: "01" },
        { id: "consultores",      href: "consultores.html",      label: "Consultores",      num: "02" },
        { id: "regioes",          href: "regioes.html",          label: "Regiões",          num: "03" },
        { id: "registros",        href: "registros.html",        label: "Registros",        num: "04" },
        { id: "criticos",         href: "criticos.html",         label: "Clientes Críticos",num: "05" },
        { id: "mapa",             href: "mapa.html",             label: "Mapa",             num: "06" },
        { id: "insights",         href: "insights.html",         label: "Insights",         num: "07" },
        { id: "negocios-mensais", href: "negocios-mensais.html", label: "Negócios",         num: "08" },
        { id: "administrativo",   href: "administrativo.html",   label: "Administrativo",   num: "09" },
      ],
    },
    {
      group: "BI Analytics",
      items: [
        { id: "index",       href: "index.html",       label: "Carteira",    num: "10" },
        { id: "comercial",   href: "comercial.html",   label: "Pipeline",    num: "11" },
        { id: "pedidos",     href: "pedidos.html",     label: "Pedidos",     num: "12" },
        { id: "operacional", href: "operacional.html", label: "Operacional", num: "13" },
        { id: "produtos",    href: "produtos.html",    label: "Produtos",    num: "14" },
        { id: "servicos",    href: "servicos.html",    label: "Serviços",    num: "15" },
        { id: "acoes",       href: "acoes.html",       label: "Ações CRM",   num: "16" },
      ],
    },
  ];

  // ── Helpers ───────────────────────────────────────────────────────────────

  function groupBy(arr, key) {
    return arr.reduce((acc, row) => {
      const k = row[key] || "Sem info";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }

  function topN(obj, n) {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([label, value]) => ({ label, value }));
  }

  function countDistinct(arr, key) {
    return new Set(arr.map(r => r[key]).filter(Boolean)).size;
  }

  function sumField(arr, key) {
    return arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0);
  }

  function avgField(arr, key) {
    const vals = arr.map(r => parseFloat(r[key])).filter(v => !isNaN(v) && v > 0);
    if (!vals.length) return 0;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  function medianField(arr, key) {
    const vals = arr.map(r => parseFloat(r[key])).filter(v => !isNaN(v) && v > 0).sort((a, b) => a - b);
    if (!vals.length) return 0;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  }

  // ── Loader admin ─────────────────────────────────────────────────────────

  async function loadAdmin() {
    if (!window.ceresDB) return MOCK.admin;
    try {
      const rows = await window.fetchAllMirror(
        "crm_carteira_clientes",
        ["cli_id_cliente", "cli_tipo_cliente", "cli_prospect", "cli_uf", "usr_nome_usuario"]
      );
      if (!rows.length) return MOCK.admin;

      // dedup por cli_id_cliente
      const seen = new Set();
      const uniq = rows.filter(r => {
        const k = String(r.cli_id_cliente ?? "");
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      const ativos    = uniq.filter(r => (r.cli_prospect || "").toLowerCase() !== "sim");
      const prospects = uniq.filter(r => (r.cli_prospect || "").toLowerCase() === "sim");

      const byConsultor = groupBy(uniq, "usr_nome_usuario");
      const byClasse    = groupBy(uniq, "cli_tipo_cliente");
      const byUF        = groupBy(uniq, "cli_uf");

      const carteiraPorConsultor = topN(byConsultor, 8)
        .filter(d => d.label !== "null" && d.label !== "Sem info");
      const classificacao = topN(byClasse, 8)
        .filter(d => d.label && d.label !== "Sem info" && d.label !== "Sem classificação")
        .slice(0, 6);
      const ufsCobertura = topN(byUF, 10)
        .filter(d => d.label && d.label.length <= 3);

      return {
        totalClientes: uniq.length,
        ativos:        ativos.length,
        prospects:     prospects.length,
        ufs:           countDistinct(uniq, "cli_uf"),
        consultores:   countDistinct(uniq, "usr_nome_usuario"),
        empresas:      uniq.length,
        carteiraPorConsultor,
        classificacao,
        ufsCobertura,
      };
    } catch (err) {
      console.warn("[Ceres BI] Erro ao carregar admin:", err.message);
      return MOCK.admin;
    }
  }

  // ── Loader comercial ─────────────────────────────────────────────────────

  async function loadComercial() {
    if (!window.ceresDB) return MOCK.comercial;
    try {
      const [negocios, usuarios] = await Promise.all([
        window.fetchAllMirror("crm_negocios", [
          "ngo_numero", "ngo_conclusao", "ngo_etapa", "ngo_vlr_total",
          "ngo_forma_entrada", "ngo_motivo_perda", "ngo_motivo_ganho",
          "ngo_ciclo_vendas", "ngo_qtd_acoes", "ngo_vendedores", "ngo_data_cadastro",
        ]),
        window.fetchAllMirror("usuarios", [
          "usr_cod_usuario", "usr_id_usuario", "usr_nome_usuario",
        ]).catch(() => []),
      ]);

      if (!negocios.length) return MOCK.comercial;

      // Vendor map: cod → nome
      const vendorMap = {};
      usuarios.forEach(u => {
        if (u.usr_cod_usuario) vendorMap[String(u.usr_cod_usuario).trim()] = u.usr_nome_usuario || u.usr_cod_usuario;
      });

      function resolveVendor(raw) {
        if (!raw) return "Sem consultor";
        const cod = String(raw).split(/[,;]/)[0].trim();
        return vendorMap[cod] || cod;
      }

      function classifyStatus(conclusao) {
        const c = (conclusao || "").toLowerCase();
        if (c.includes("ganho")) return "ganho";
        if (c.includes("perd"))  return "perdido";
        return "andamento";
      }

      const rows = negocios.map(r => ({
        ...r,
        _status: classifyStatus(r.ngo_conclusao),
        _valor:  parseFloat(r.ngo_vlr_total) || 0,
        _vendor: resolveVendor(r.ngo_vendedores),
      }));

      const ganhos    = rows.filter(r => r._status === "ganho");
      const perdidos  = rows.filter(r => r._status === "perdido");
      const andamento = rows.filter(r => r._status === "andamento");

      const totalGanhos   = ganhos.length;
      const totalPerdidos = perdidos.length;
      const concluded     = totalGanhos + totalPerdidos;
      const taxaConversao = concluded > 0 ? (totalGanhos / concluded) * 100 : 0;
      const valorGanho    = ganhos.reduce((s, r) => s + r._valor, 0);
      const pipelineAberto = andamento.reduce((s, r) => s + r._valor, 0);
      const ticketMedioGanho = totalGanhos > 0 ? valorGanho / totalGanhos : 0;

      const cicloVals = rows
        .filter(r => r._status !== "andamento" && parseFloat(r.ngo_ciclo_vendas) > 0)
        .map(r => parseFloat(r.ngo_ciclo_vendas));
      const cicloMedioDias = cicloVals.length ? cicloVals.reduce((s, v) => s + v, 0) / cicloVals.length : 0;

      const acaoVals = rows.filter(r => parseFloat(r.ngo_qtd_acoes) > 0).map(r => parseFloat(r.ngo_qtd_acoes));
      const esforcoMedio = acaoVals.length ? acaoVals.reduce((s, v) => s + v, 0) / acaoVals.length : 0;

      // Funil por etapa (andamento)
      const funilMap = {};
      andamento.forEach(r => {
        const e = r.ngo_etapa || "Sem etapa";
        if (!funilMap[e]) funilMap[e] = { valor: 0, qtd: 0 };
        funilMap[e].valor += r._valor;
        funilMap[e].qtd++;
      });
      const funilPorEtapa = Object.entries(funilMap)
        .map(([label, d]) => ({ label, value: d.valor, qtd: d.qtd }))
        .sort((a, b) => {
          const na = parseInt(a.label) || 999;
          const nb = parseInt(b.label) || 999;
          return na - nb;
        })
        .slice(0, 10);

      // Por origem
      const origemMap = {};
      rows.forEach(r => {
        const o = r.ngo_forma_entrada || "Sem origem";
        if (!origemMap[o]) origemMap[o] = { ganhos: 0, perdidos: 0, andamento: 0 };
        origemMap[o][r._status]++;
      });
      const porOrigem = Object.entries(origemMap)
        .map(([label, d]) => ({ label, ...d, total: d.ganhos + d.perdidos + d.andamento }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map(({ total: _t, ...rest }) => rest);

      // Motivos de perda
      const perdaMap = {};
      perdidos.forEach(r => {
        const m = r.ngo_motivo_perda || "Não informado";
        if (!perdaMap[m]) perdaMap[m] = { valor: 0, qtd: 0 };
        perdaMap[m].valor += r._valor;
        perdaMap[m].qtd++;
      });
      const motivosPerda = Object.entries(perdaMap)
        .map(([label, d]) => ({ label, value: d.valor, qtd: d.qtd }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      // Evolução mensal (últimos 12 meses)
      const mensalMap = {};
      rows.forEach(r => {
        const m = (r.ngo_data_cadastro || "").slice(0, 7);
        if (!m) return;
        if (!mensalMap[m]) mensalMap[m] = { novos: 0, valorCriado: 0 };
        mensalMap[m].novos++;
        mensalMap[m].valorCriado += r._valor;
      });
      const evolucaoMensal = Object.entries(mensalMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([name, d]) => ({ name, ...d }));

      // Ranking consultores
      const consultorMap = {};
      rows.forEach(r => {
        const v = r._vendor;
        if (!consultorMap[v]) consultorMap[v] = { valor: 0, ganhos: 0, total: 0 };
        consultorMap[v].total++;
        if (r._status === "ganho") {
          consultorMap[v].valor += r._valor;
          consultorMap[v].ganhos++;
        }
      });
      const rankingConsultor = Object.entries(consultorMap)
        .map(([label, d]) => ({
          label,
          value: d.valor,
          ganhos: d.ganhos,
          total: d.total,
          taxa: d.total > 0 ? Math.round((d.ganhos / d.total) * 100) : 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      return {
        totalNegocios: rows.length,
        ganhos: totalGanhos,
        perdidos: totalPerdidos,
        andamento: andamento.length,
        taxaConversao,
        pipelineAberto,
        valorGanho,
        ticketMedioGanho,
        cicloMedioDias,
        esforcoMedio,
        funilPorEtapa,
        porOrigem,
        motivosPerda,
        evolucaoMensal,
        rankingConsultor,
      };
    } catch (err) {
      console.warn("[Ceres BI] Erro ao carregar comercial:", err.message);
      return MOCK.comercial;
    }
  }

  // ── Loader pedidos ───────────────────────────────────────────────────────

  async function loadPedidos() {
    if (!window.ceresDB) return MOCK.pedidos;
    try {
      const [pedidos, itens] = await Promise.all([
        window.fetchAllMirror("crm_pedidos", [
          "ngo_numero", "pdo_situacao", "pdo_vlr_pedido", "pdo_vlr_financiado",
          "pdo_vlr_recurso_proprio", "pdo_cidade_uf_entrega", "pdo_vendedor", "pdo_dth_pedido",
        ]),
        window.fetchAllMirror("crm_pedidos_item", [
          "pdo_item_grupo", "pdo_item_marca", "pdo_item_modelo",
          "pdo_item_qtde", "pdo_item_vlr_unitario",
        ]).catch(() => []),
      ]);

      if (!pedidos.length) return MOCK.pedidos;

      const rows = pedidos.map(r => ({
        ...r,
        _aprovado: (r.pdo_situacao || "").toUpperCase().includes("APROVADO"),
        _cancelado: (r.pdo_situacao || "").toUpperCase().includes("CANCEL"),
        _valor: parseFloat(r.pdo_vlr_pedido) || 0,
        _financiado: parseFloat(r.pdo_vlr_financiado) || 0,
        _proprio: parseFloat(r.pdo_vlr_recurso_proprio) || 0,
      }));

      const aprovados = rows.filter(r => r._aprovado);
      const faturamentoAprovado = aprovados.reduce((s, r) => s + r._valor, 0);
      const ticketMedio = aprovados.length > 0 ? faturamentoAprovado / aprovados.length : 0;
      const taxaAprovacao = rows.length > 0 ? (aprovados.length / rows.length) * 100 : 0;
      const totalFinanciado = aprovados.reduce((s, r) => s + r._financiado, 0);
      const pctFinanciado = faturamentoAprovado > 0 ? (totalFinanciado / faturamentoAprovado) * 100 : 0;
      const valorCancelado = rows.filter(r => r._cancelado).reduce((s, r) => s + r._valor, 0);

      // Evolução mensal aprovados
      const mensalMap = {};
      aprovados.forEach(r => {
        const m = (r.pdo_dth_pedido || "").slice(0, 7);
        if (!m) return;
        if (!mensalMap[m]) mensalMap[m] = { faturamento: 0, qtd: 0 };
        mensalMap[m].faturamento += r._valor;
        mensalMap[m].qtd++;
      });
      const evolucaoMensal = Object.entries(mensalMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([name, d]) => ({ name, ...d }));

      // Mix de pagamento
      const totalProprio = aprovados.reduce((s, r) => s + r._proprio, 0);
      const mixPagamento = [
        { label: "Recurso Próprio", value: totalProprio },
        { label: "Financiado", value: totalFinanciado },
      ];

      // Por situação
      const sitMap = {};
      rows.forEach(r => {
        const s = r.pdo_situacao || "Sem situação";
        if (!sitMap[s]) sitMap[s] = { valor: 0, qtd: 0 };
        sitMap[s].valor += r._valor;
        sitMap[s].qtd++;
      });
      const porSituacao = Object.entries(sitMap)
        .map(([label, d]) => ({ label, value: d.valor, qtd: d.qtd }))
        .sort((a, b) => b.value - a.value);

      // Por vendedor (aprovados)
      const vendMap = {};
      aprovados.forEach(r => {
        const v = r.pdo_vendedor || "Sem vendedor";
        vendMap[v] = (vendMap[v] || 0) + r._valor;
      });
      const porVendedor = Object.entries(vendMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Por cidade (aprovados)
      const cidMap = {};
      aprovados.forEach(r => {
        const c = r.pdo_cidade_uf_entrega || "Sem cidade";
        cidMap[c] = (cidMap[c] || 0) + r._valor;
      });
      const porCidade = Object.entries(cidMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Por grupo (itens)
      const grupoMap = {};
      itens.forEach(r => {
        const g = r.pdo_item_grupo || "Sem grupo";
        const val = (parseFloat(r.pdo_item_qtde) || 0) * (parseFloat(r.pdo_item_vlr_unitario) || 0);
        if (!grupoMap[g]) grupoMap[g] = { valor: 0, qtd: 0 };
        grupoMap[g].valor += val;
        grupoMap[g].qtd += parseFloat(r.pdo_item_qtde) || 0;
      });
      const porGrupo = Object.entries(grupoMap)
        .map(([label, d]) => ({ label, value: d.valor, qtd: d.qtd }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      return {
        totalPedidos: rows.length,
        faturamentoAprovado,
        ticketMedio,
        taxaAprovacao,
        pctFinanciado,
        valorCancelado,
        evolucaoMensal,
        mixPagamento,
        porSituacao,
        porVendedor,
        porCidade,
        porGrupo,
      };
    } catch (err) {
      console.warn("[Ceres BI] Erro ao carregar pedidos:", err.message);
      return MOCK.pedidos;
    }
  }

  // ── Loader operacional ────────────────────────────────────────────────────

  async function loadOperacional() {
    if (!window.ceresDB) return MOCK.operacional;
    try {
      const [ordens, acoes] = await Promise.all([
        window.fetchAllMirror("ordens_servico", [
          "os_nr_os", "os_f_status", "sit_dsc_situacao_os",
          "os_dth_abertura", "os_dth_encerramento",
        ]),
        window.fetchAllMirror("crm_acoes", [
          "aco_vendedor", "aco_tipo_acao", "aco_tipo_contato",
          "aco_dth_conclusao", "emp_cidade", "cli_nome",
        ]).catch(() => []),
      ]);

      if (!ordens.length) return MOCK.operacional;

      function isAberta(r) {
        const s = (r.sit_dsc_situacao_os || r.os_f_status || "").toLowerCase();
        return s.includes("aberto") || s.includes("aberta");
      }
      function isEncerrada(r) {
        const s = (r.sit_dsc_situacao_os || r.os_f_status || "").toLowerCase();
        return s.includes("encerrada") || s.includes("fechada");
      }

      const totalOS    = ordens.length;
      const osAbertas  = ordens.filter(isAberta).length;
      const encerradas = ordens.filter(isEncerrada);
      const taxaFechamento = totalOS > 0 ? (encerradas.length / totalOS) * 100 : 0;

      // Tempo de resolução
      const diasResolucao = encerradas
        .filter(r => r.os_dth_abertura && r.os_dth_encerramento)
        .map(r => (new Date(r.os_dth_encerramento) - new Date(r.os_dth_abertura)) / 86400000)
        .filter(d => d > 0);

      const tempoMedioResolucao = diasResolucao.length
        ? diasResolucao.reduce((s, v) => s + v, 0) / diasResolucao.length
        : 0;

      const sorted = [...diasResolucao].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianaResolucao = sorted.length
        ? (sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
        : 0;

      // Por status
      const statusMap = {};
      ordens.forEach(r => {
        const s = r.sit_dsc_situacao_os || r.os_f_status || "Sem status";
        statusMap[s] = (statusMap[s] || 0) + 1;
      });
      const porStatus = Object.entries(statusMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

      // Faixas de resolução
      const bins = { "0-1d": 0, "2-3d": 0, "4-7d": 0, "8-15d": 0, "16-30d": 0, "+30d": 0 };
      diasResolucao.forEach(d => {
        if (d <= 1) bins["0-1d"]++;
        else if (d <= 3) bins["2-3d"]++;
        else if (d <= 7) bins["4-7d"]++;
        else if (d <= 15) bins["8-15d"]++;
        else if (d <= 30) bins["16-30d"]++;
        else bins["+30d"]++;
      });
      const faixasResolucao = Object.entries(bins).map(([label, value]) => ({ label, value }));

      // Evolução aberturas
      const aberturaMensal = {};
      ordens.forEach(r => {
        const m = (r.os_dth_abertura || "").slice(0, 7);
        if (!m) return;
        aberturaMensal[m] = (aberturaMensal[m] || 0) + 1;
      });
      const evolucaoAberturas = Object.entries(aberturaMensal)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([name, value]) => ({ name, value }));

      // Dados de acoes (técnicos)
      const totalOcorrencias = acoes.length;
      const tecnicosAtivos = countDistinct(acoes, "aco_vendedor");
      const kmRodado = 0;
      const utilizacaoMedia = 0;
      const tempoOcioso = 0;

      // Situação das ocorrências (via tipo de contato)
      const sitOcorMap = {};
      acoes.forEach(r => {
        const s = r.aco_tipo_contato || "Sem status";
        sitOcorMap[s] = (sitOcorMap[s] || 0) + 1;
      });
      const situacaoOcorrencias = Object.entries(sitOcorMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

      // Tipos de serviço via aco_tipo_acao
      const tipoMap = {};
      acoes.forEach(r => {
        const t = r.aco_tipo_acao || "Sem tipo";
        tipoMap[t] = (tipoMap[t] || 0) + 1;
      });
      const tiposSorted = Object.entries(tipoMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

      const motivosPausa    = tiposSorted.slice(0, 8);
      const causasAtendimento = tiposSorted.slice(0, 10);

      // Ações por vendedor (proxy para atividade dos técnicos)
      const tecMap = {};
      acoes.forEach(r => {
        const t = r.aco_vendedor || "Sem técnico";
        if (!tecMap[t]) tecMap[t] = { count: 0 };
        tecMap[t].count++;
      });
      const utilizacaoPorTecnico = Object.entries(tecMap)
        .map(([label, d]) => ({
          label,
          atendimento: d.count,
          deslocamento: 0,
          ocioso: 0,
        }))
        .sort((a, b) => b.atendimento - a.atendimento)
        .slice(0, 10);

      const kmPorTecnico = [];

      return {
        totalOS,
        osAbertas,
        taxaFechamento,
        tempoMedioResolucao,
        medianaResolucao,
        totalOcorrencias,
        tecnicosAtivos,
        kmRodado,
        utilizacaoMedia,
        tempoOcioso,
        porStatus,
        faixasResolucao,
        evolucaoAberturas,
        situacaoOcorrencias,
        motivosPausa,
        causasAtendimento,
        utilizacaoPorTecnico,
        kmPorTecnico,
      };
    } catch (err) {
      console.warn("[Ceres BI] Erro ao carregar operacional:", err.message);
      return MOCK.operacional;
    }
  }

  // ── Loader produtos ───────────────────────────────────────────────────────

  async function loadProdutos() {
    if (!window.ceresDB) return MOCK.produtos;
    try {
      const rows = await window.fetchAllMirror("cliente_parque_maquinas", [
        "cli_id_cliente", "pqm_grupo", "pqm_marca", "pqm_modelo", "pqm_qtd_maquinas",
      ]);

      if (!rows.length) return MOCK.produtos;

      const maquinasInstaladas = rows.reduce((s, r) => s + (parseInt(r.pqm_qtd_maquinas) || 1), 0);
      const clientesComParque  = countDistinct(rows, "cli_id_cliente");
      const grupos             = countDistinct(rows, "pqm_grupo");
      const marcas             = countDistinct(rows, "pqm_marca");

      const grupoMap = {};
      rows.forEach(r => {
        const g = r.pqm_grupo || "Sem grupo";
        grupoMap[g] = (grupoMap[g] || 0) + (parseInt(r.pqm_qtd_maquinas) || 1);
      });
      const porGrupo = Object.entries(grupoMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const marcaMap = {};
      rows.forEach(r => {
        const m = r.pqm_marca || "Sem marca";
        marcaMap[m] = (marcaMap[m] || 0) + (parseInt(r.pqm_qtd_maquinas) || 1);
      });
      const porMarca = Object.entries(marcaMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      const modeloMap = {};
      rows.forEach(r => {
        const m = r.pqm_modelo || "Sem modelo";
        modeloMap[m] = (modeloMap[m] || 0) + (parseInt(r.pqm_qtd_maquinas) || 1);
      });
      const topModelos = Object.entries(modeloMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);

      return { maquinasInstaladas, clientesComParque, grupos, marcas, porGrupo, porMarca, topModelos };
    } catch (err) {
      console.warn("[Ceres BI] Erro ao carregar produtos:", err.message);
      return MOCK.produtos;
    }
  }

  // ── Loader acoes ──────────────────────────────────────────────────────────

  async function loadAcoes() {
    if (!window.ceresDB) return MOCK.acoes;
    try {
      const rows = await window.fetchAllMirror("crm_acoes", [
        "aco_dth_conclusao", "aco_vendedor", "emp_cidade", "cli_nome",
        "aco_tipo_acao", "aco_tipo_contato",
      ]);

      if (!rows.length) return MOCK.acoes;

      function computeStats(data) {
        const totalAcoes          = data.length;
        const cidades             = countDistinct(data, "emp_cidade");
        const consultores         = countDistinct(data, "aco_vendedor");
        const clientes            = countDistinct(data, "cli_nome");
        const visitas             = data.filter(r => (r.aco_tipo_contato || "").toLowerCase().includes("visita")).length;
        const tiposAcaoDistintos  = countDistinct(data, "aco_tipo_acao");

        const vendMap = {};
        data.forEach(r => {
          const v = r.aco_vendedor || "Sem consultor";
          vendMap[v] = (vendMap[v] || 0) + 1;
        });
        const porVendedor = Object.entries(vendMap)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 15);

        const mensalMap = {};
        data.forEach(r => {
          const m = (r.aco_dth_conclusao || "").slice(0, 7);
          if (!m) return;
          mensalMap[m] = (mensalMap[m] || 0) + 1;
        });
        const evolucaoMensal = Object.entries(mensalMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([name, value]) => ({ name, value }));

        const cidMap = {};
        data.forEach(r => {
          const c = r.emp_cidade || "Sem cidade";
          cidMap[c] = (cidMap[c] || 0) + 1;
        });
        const porCidade = Object.entries(cidMap)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 15);

        const tipoAcaoMap = {};
        data.forEach(r => {
          const t = r.aco_tipo_acao || "Sem tipo";
          tipoAcaoMap[t] = (tipoAcaoMap[t] || 0) + 1;
        });
        const porTipoAcao = Object.entries(tipoAcaoMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const diasMap = { Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sáb: 0, Dom: 0 };
        data.forEach(r => {
          const d = r.aco_dth_conclusao;
          if (!d) return;
          const day = DAYS[new Date(d).getDay()];
          if (day) diasMap[day]++;
        });
        const diasOrder = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
        const porDiaSemana = diasOrder.map(name => ({ name, value: diasMap[name] || 0 }));

        const contatoMap = {};
        data.forEach(r => {
          const c = r.aco_tipo_contato || "Sem contato";
          contatoMap[c] = (contatoMap[c] || 0) + 1;
        });
        const porTipoContato = Object.entries(contatoMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        return {
          totalAcoes, cidades, consultores, visitas, clientes, tiposAcaoDistintos,
          porVendedor, evolucaoMensal, porCidade, porTipoAcao, porDiaSemana, porTipoContato,
        };
      }

      const base = computeStats(rows);

      // Listas para filtros
      const listaAnos = [...new Set(
        rows.map(r => (r.aco_dth_conclusao || "").slice(0, 4)).filter(Boolean)
      )].sort().reverse();
      const listaVendedores = [...new Set(rows.map(r => r.aco_vendedor).filter(Boolean))].sort();
      const tiposAcao       = [...new Set(rows.map(r => r.aco_tipo_acao).filter(Boolean))].sort();
      const listaCidades    = [...new Set(rows.map(r => r.emp_cidade).filter(Boolean))].sort();

      return {
        ...base,
        listaAnos,
        listaVendedores,
        tiposAcao,
        listaCidades,
        _rawRows: rows,
      };
    } catch (err) {
      console.warn("[Ceres BI] Erro ao carregar acoes:", err.message);
      return MOCK.acoes;
    }
  }

  // ── Loader CRM (DadosComerciais — 9 páginas CRM) ─────────────────────────

  const ADMIN_USERS = [
    "camila esser colet", "ana paula", "daniel cesar canoth",
    "mathias henrique montinelli picinato", "tainara trevisa", "tainara trevisan",
    "alex paulo ranzan", "alex ranzan", "andre candiotto",
  ];
  function isAdminUser(name) {
    if (!name) return false;
    const n = name.trim().toLowerCase().replace(/\s+- .+$/, "");
    return ADMIN_USERS.some(a => a === n || n.includes(a) || a.includes(n));
  }

  async function loadCRM() {
    if (!window.ceresDB) return MOCK.crm;
    try {
      const [acoes, negocios, usuarios] = await Promise.all([
        window.fetchAllMirror("crm_acoes", [
          "aco_dth_conclusao", "aco_vendedor", "emp_cidade", "cli_nome",
          "aco_tipo_acao", "aco_tipo_contato", "aco_atividade_executada",
          "aco_lat", "aco_lon",
        ]),
        window.fetchAllMirror("crm_negocios", [
          "ngo_numero", "ngo_conclusao", "ngo_etapa", "ngo_vlr_total",
          "ngo_vendedores", "ngo_data_cadastro",
        ]),
        window.fetchAllMirror("usuarios", [
          "usr_cod_usuario", "usr_nome_usuario",
        ]).catch(() => []),
      ]);

      if (!acoes.length) return MOCK.crm;

      const vCodeMap = {};
      usuarios.forEach(u => {
        if (u.usr_cod_usuario) vCodeMap[String(u.usr_cod_usuario).trim()] = u.usr_nome_usuario || u.usr_cod_usuario;
      });
      function resolveVendorCode(raw) {
        if (!raw) return null;
        const cod = String(raw).split(/[,;]/)[0].trim();
        return vCodeMap[cod] || cod;
      }

      // Pipeline map: vendorName → {pipeline(andamento), negocios, ganhos, perdidos}
      const pipelineMap = new Map();
      negocios.forEach(n => {
        const vName = resolveVendorCode(n.ngo_vendedores);
        if (!vName) return;
        const c = (n.ngo_conclusao || "").toLowerCase();
        const status = c.includes("ganho") ? "ganho" : c.includes("perd") ? "perdido" : "andamento";
        const valor = parseFloat(n.ngo_vlr_total) || 0;
        if (!pipelineMap.has(vName)) pipelineMap.set(vName, { pipeline: 0, negocios: 0, ganhos: 0, perdidos: 0 });
        const e = pipelineMap.get(vName);
        e.negocios++;
        if (status === "andamento") e.pipeline += valor;
        if (status === "ganho") e.ganhos++;
        if (status === "perdido") e.perdidos++;
      });

      const hoje = new Date();
      function daysSince(dateStr) {
        if (!dateStr) return 9999;
        const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : ""));
        return Math.max(0, Math.floor((hoje - d) / 86400000));
      }

      // registrosRecentes (newest 500)
      const registrosRecentes = acoes
        .filter(r => r.aco_dth_conclusao)
        .sort((a, b) => (b.aco_dth_conclusao || "").localeCompare(a.aco_dth_conclusao || ""))
        .slice(0, 500)
        .map(r => ({
          cliente:      r.cli_nome || "",
          cidade:       r.emp_cidade || "",
          vendedor:     r.aco_vendedor || "",
          tipoContato:  r.aco_tipo_contato || "",
          tipoAcao:     r.aco_tipo_acao || "",
          negocioValor: 0,
          negocioEtapa: "",
          dtConclusao:  (r.aco_dth_conclusao || "").slice(0, 10),
          obs:          r.aco_atividade_executada || "",
          lat:          parseFloat(r.aco_lat) || null,
          lng:          parseFloat(r.aco_lon) || null,
        }));

      // Build per-vendedor data
      const vMap = new Map();
      acoes.forEach(r => {
        const v = r.aco_vendedor;
        if (!v) return;
        if (!vMap.has(v)) vMap.set(v, { rows: [], clientes: new Map(), cidades: new Set() });
        const e = vMap.get(v);
        e.rows.push(r);
        if (r.emp_cidade) e.cidades.add(r.emp_cidade);
        if (r.cli_nome) {
          if (!e.clientes.has(r.cli_nome)) e.clientes.set(r.cli_nome, { nome: r.cli_nome, cidade: r.emp_cidade || "", acoes: 0, visitas: 0, lastDate: null });
          const ce = e.clientes.get(r.cli_nome);
          ce.acoes++;
          if ((r.aco_tipo_contato || "").toLowerCase().includes("visita")) ce.visitas++;
          if (!ce.lastDate || (r.aco_dth_conclusao || "") > ce.lastDate) ce.lastDate = r.aco_dth_conclusao;
        }
      });

      const vendedores = Array.from(vMap.entries()).map(([nome, e]) => {
        const totalAcoes = e.rows.length;
        const visitas = e.rows.filter(r => (r.aco_tipo_contato || "").toLowerCase().includes("visita")).length;
        const clientes = e.clientes.size;
        const p = pipelineMap.get(nome) || { pipeline: 0, negocios: 0, ganhos: 0, perdidos: 0 };
        const concluded = p.ganhos + p.perdidos;
        const conversao = concluded > 0 ? Math.round((p.ganhos / concluded) * 100) : 0;

        const monthMap = {};
        e.rows.forEach(r => {
          const m = (r.aco_dth_conclusao || "").slice(0, 7);
          if (!m) return;
          if (!monthMap[m]) monthMap[m] = { acoes: 0, visitas: 0 };
          monthMap[m].acoes++;
          if ((r.aco_tipo_contato || "").toLowerCase().includes("visita")) monthMap[m].visitas++;
        });
        const evolucao = Object.entries(monthMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, d]) => ({ month, ...d }));

        const topClientes = Array.from(e.clientes.values())
          .map(c => ({ ...c, diasSemContato: daysSince(c.lastDate) }))
          .sort((a, b) => b.acoes - a.acoes);

        const tiposAcao = {};
        e.rows.forEach(r => { if (r.aco_tipo_acao) tiposAcao[r.aco_tipo_acao] = (tiposAcao[r.aco_tipo_acao] || 0) + 1; });

        const regMap = {};
        e.rows.forEach(r => { if (r.emp_cidade) regMap[r.emp_cidade] = (regMap[r.emp_cidade] || 0) + 1; });
        const regioes = Object.entries(regMap)
          .map(([cidade, acoes]) => ({ cidade, acoes }))
          .sort((a, b) => b.acoes - a.acoes);

        return {
          nome, totalAcoes, visitas, clientes,
          pipeline: p.pipeline, negocios: p.negocios, ganhos: p.ganhos,
          conversao, crmQuality: 0, evolucao, topClientes, regioes, tiposAcao,
          isAdmin: isAdminUser(nome),
        };
      });

      const maxAcoes    = Math.max(...vendedores.map(v => v.totalAcoes), 1);
      const maxPipeline = Math.max(...vendedores.map(v => v.pipeline), 1);
      const maxClients  = Math.max(...vendedores.map(v => v.clientes), 1);
      const maxVisitas  = Math.max(...vendedores.map(v => v.visitas), 1);
      vendedores.forEach(v => {
        v.crmQuality = Math.min(100, Math.round(
          (v.totalAcoes / maxAcoes) * 25 +
          v.conversao * 0.25 +
          (v.pipeline / maxPipeline) * 25 +
          (v.clientes / maxClients) * 15 +
          (v.visitas / maxVisitas) * 10
        ));
      });

      // Global regioes
      const regionMap = new Map();
      acoes.forEach(r => {
        const c = r.emp_cidade;
        if (!c) return;
        if (!regionMap.has(c)) regionMap.set(c, { cidade: c, totalAcoes: 0, clientes: new Set(), visitas: 0, lat: null, lng: null });
        const e = regionMap.get(c);
        e.totalAcoes++;
        if (r.cli_nome) e.clientes.add(r.cli_nome);
        if ((r.aco_tipo_contato || "").toLowerCase().includes("visita")) e.visitas++;
        if (!e.lat && r.aco_lat) e.lat = parseFloat(r.aco_lat);
        if (!e.lng && r.aco_lon) e.lng = parseFloat(r.aco_lon);
      });
      const regioes = Array.from(regionMap.values())
        .map(r => ({ cidade: r.cidade, totalAcoes: r.totalAcoes, clientes: r.clientes.size, pipeline: 0, visitas: r.visitas, lat: r.lat, lng: r.lng }))
        .sort((a, b) => b.totalAcoes - a.totalAcoes);

      const tiposContato = {};
      const tiposAcao = {};
      acoes.forEach(r => {
        if (r.aco_tipo_contato) tiposContato[r.aco_tipo_contato] = (tiposContato[r.aco_tipo_contato] || 0) + 1;
        if (r.aco_tipo_acao) tiposAcao[r.aco_tipo_acao] = (tiposAcao[r.aco_tipo_acao] || 0) + 1;
      });

      const evolMap = new Map();
      acoes.forEach(r => {
        const ym = (r.aco_dth_conclusao || "").slice(0, 7);
        if (!ym) return;
        if (!evolMap.has(ym)) evolMap.set(ym, { YearMonth: ym, acoes: 0, visitas: 0, clientes: new Set() });
        const e = evolMap.get(ym);
        e.acoes++;
        if ((r.aco_tipo_contato || "").toLowerCase().includes("visita")) e.visitas++;
        if (r.cli_nome) e.clientes.add(r.cli_nome);
      });
      const evolucaoGlobal = Array.from(evolMap.values())
        .sort((a, b) => a.YearMonth.localeCompare(b.YearMonth))
        .map(e => ({ YearMonth: e.YearMonth, acoes: e.acoes, visitas: e.visitas, clientes: e.clientes.size }));

      const totalPipeline = Array.from(pipelineMap.values()).reduce((s, v) => s + v.pipeline, 0);
      const totalConsultores = vendedores.filter(v => !v.isAdmin).length;

      return {
        kpis: {
          totalRegistros: acoes.length,
          totalClientes:   countDistinct(acoes, "cli_nome"),
          totalConsultores,
          totalPipeline,
          totalVisitas:    acoes.filter(r => (r.aco_tipo_contato || "").toLowerCase().includes("visita")).length,
          totalCidades:    countDistinct(acoes, "emp_cidade"),
        },
        vendedores: vendedores.sort((a, b) => b.totalAcoes - a.totalAcoes),
        regioes,
        evolucaoGlobal,
        tiposContato,
        tiposAcao,
        registrosRecentes,
        listaVendedores: [...new Set(acoes.map(r => r.aco_vendedor).filter(Boolean))].sort(),
        listaCidades:    [...new Set(acoes.map(r => r.emp_cidade).filter(Boolean))].sort(),
      };
    } catch (err) {
      console.warn("[Ceres BI] Erro ao carregar CRM:", err.message);
      return MOCK.crm;
    }
  }

  // ── Loader Negócios Mensais ───────────────────────────────────────────────

  async function loadNegociosMensais() {
    if (!window.ceresDB) return MOCK.negociosMensais;
    try {
      const [negocios, pedidos, usuarios] = await Promise.all([
        window.fetchAllMirror("crm_negocios", [
          "ngo_numero", "ngo_conclusao", "ngo_etapa", "ngo_vlr_total",
          "ngo_vendedores", "ngo_data_cadastro", "cli_nome", "emp_cidade",
        ]),
        window.fetchAllMirror("crm_pedidos", [
          "ngo_numero", "pdo_vlr_pedido", "pdo_vlr_recurso_proprio",
          "pdo_cidade_uf_entrega", "pdo_vendedor", "pdo_dth_pedido",
        ]).catch(() => []),
        window.fetchAllMirror("usuarios", [
          "usr_cod_usuario", "usr_nome_usuario",
        ]).catch(() => []),
      ]);

      if (!negocios.length) return MOCK.negociosMensais;

      const vCodeMap = {};
      usuarios.forEach(u => {
        if (u.usr_cod_usuario) vCodeMap[String(u.usr_cod_usuario).trim()] = u.usr_nome_usuario || u.usr_cod_usuario;
      });
      function resolveCode(raw) {
        if (!raw) return "Sem consultor";
        const cod = String(raw).split(/[,;]/)[0].trim();
        return vCodeMap[cod] || cod;
      }

      const pedidoMap = new Map();
      pedidos.forEach(p => {
        if (p.ngo_numero) {
          if (!pedidoMap.has(p.ngo_numero)) pedidoMap.set(p.ngo_numero, []);
          pedidoMap.get(p.ngo_numero).push(p);
        }
      });

      const rows = negocios.map(n => {
        const pdos = pedidoMap.get(n.ngo_numero) || [];
        const pdo = pdos[0] || null;
        const valorPedido = pdo ? (parseFloat(pdo.pdo_vlr_pedido) || 0) : (parseFloat(n.ngo_vlr_total) || 0);
        const recebido    = pdo ? (parseFloat(pdo.pdo_vlr_recurso_proprio) || 0) : 0;
        const consultor   = resolveCode(n.ngo_vendedores);
        const dataAbertura = pdo ? pdo.pdo_dth_pedido : n.ngo_data_cadastro;
        const unidade     = pdo ? (pdo.pdo_cidade_uf_entrega || n.emp_cidade || "") : (n.emp_cidade || "");
        return {
          cliente:         n.cli_nome || "",
          consultor,
          valor_pedido:    valorPedido,
          recebido,
          ngo_conclusao:   n.ngo_conclusao || "",
          ngo_etapa:       n.ngo_etapa || "",
          pdo_dth_abertura: (dataAbertura || "").slice(0, 10),
          unidade,
        };
      });

      const ganhos     = rows.filter(r => (r.ngo_conclusao || "").toLowerCase().includes("ganho"));
      const perdidos   = rows.filter(r => (r.ngo_conclusao || "").toLowerCase().includes("perd"));
      const emAndamento = rows.filter(r => {
        const c = (r.ngo_conclusao || "").toLowerCase();
        return !c.includes("ganho") && !c.includes("perd");
      });
      const totalValor    = rows.reduce((s, r) => s + r.valor_pedido, 0);
      const totalRecebido = rows.reduce((s, r) => s + r.recebido, 0);
      const totalUsado    = rows.reduce((s, r) => s + Math.max(0, r.valor_pedido - r.recebido), 0);
      const percentUsado  = totalValor > 0 ? (totalUsado / totalValor) * 100 : 0;
      const clientesAtendidos = new Set(rows.map(r => r.cliente).filter(Boolean)).size;
      const taxaConversao = (ganhos.length + perdidos.length) > 0
        ? Math.round(ganhos.length / (ganhos.length + perdidos.length) * 100) : 0;

      // Evolução mensal
      const evolMap = new Map();
      rows.forEach(r => {
        const ym = (r.pdo_dth_abertura || "").slice(0, 7);
        if (!ym) return;
        if (!evolMap.has(ym)) evolMap.set(ym, { mes: ym, total: 0, valor: 0, ganhos: 0 });
        const e = evolMap.get(ym);
        e.total++;
        e.valor += r.valor_pedido;
        if ((r.ngo_conclusao || "").toLowerCase().includes("ganho")) e.ganhos++;
      });
      const evolucaoMensal = Array.from(evolMap.values())
        .sort((a, b) => a.mes.localeCompare(b.mes));

      // Por consultor
      const cMap = new Map();
      rows.forEach(r => {
        const c = r.consultor;
        if (!cMap.has(c)) cMap.set(c, { total: 0, valor: 0, ganhos: 0, recebido: 0, usado: 0, clientes: new Set() });
        const e = cMap.get(c);
        e.total++;
        e.valor += r.valor_pedido;
        e.recebido += r.recebido;
        e.usado += Math.max(0, r.valor_pedido - r.recebido);
        if (r.cliente) e.clientes.add(r.cliente);
        if ((r.ngo_conclusao || "").toLowerCase().includes("ganho")) e.ganhos++;
      });
      const porConsultor = Array.from(cMap.entries())
        .map(([nome, c]) => ({
          nome,
          total: c.total,
          valor: c.valor,
          ganhos: c.ganhos,
          conversao: c.total > 0 ? Math.round(c.ganhos / c.total * 100) : 0,
          ticketMedio: c.total > 0 ? c.valor / c.total : 0,
          clientesAtendidos: c.clientes.size,
          recebido: c.recebido,
          usado: c.usado,
          percentUsado: c.valor > 0 ? c.usado / c.valor * 100 : 0,
          clientes: [],
        }))
        .sort((a, b) => b.valor - a.valor);

      // Por região
      const rMap = new Map();
      rows.forEach(r => {
        const reg = r.unidade || "Sem região";
        if (!rMap.has(reg)) rMap.set(reg, { regiao: reg, total: 0, valor: 0, ganhos: 0 });
        const e = rMap.get(reg);
        e.total++;
        e.valor += r.valor_pedido;
        if ((r.ngo_conclusao || "").toLowerCase().includes("ganho")) e.ganhos++;
      });
      const porRegiao = Array.from(rMap.values()).sort((a, b) => b.valor - a.valor);

      return {
        totalNegocios: rows.length,
        totalValor,
        ticketMedio: rows.length > 0 ? totalValor / rows.length : 0,
        ganhos: ganhos.length,
        emAndamento: emAndamento.length,
        perdidos: perdidos.length,
        taxaConversao,
        clientesAtendidos,
        totalRecebido,
        totalUsado,
        percentUsado,
        evolucaoMensal,
        porConsultor,
        porRegiao,
        registros: rows,
      };
    } catch (err) {
      console.warn("[Ceres BI] Erro ao carregar negócios mensais:", err.message);
      return MOCK.negociosMensais;
    }
  }

  // ── Inicialização ─────────────────────────────────────────────────────────

  const page = document.body ? document.body.dataset.page : null;

  let resolveReady;
  window.CERES_DATA_READY = new Promise(res => { resolveReady = res; });

  window.CERES_DATA = {
    nav: NAV,
    fmtBRL: (n) => (n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })),
    fmtNum: (n) => (n == null ? "—" : n.toLocaleString("pt-BR")),
    fmtPct: (n) => (n == null ? "—" : `${n.toFixed(1)}%`),
    fmtBRLShort: (n) => {
      if (n == null) return "—";
      if (n >= 1e6) return `R$ ${(n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
      if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)}K`;
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    },
    fmtMonthYear: (ym) => {
      if (!ym) return ym;
      const [y, m] = ym.split("-");
      const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
      return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
    },
    admin: null,
    comercial: null,
    pedidos: null,
    operacional: null,
    produtos: null,
    servicos: null,
    acoes: null,
    crm: null,
    negociosMensais: null,
    isAdminUser,
  };
  // layout.js lê VOUX_DATA.nav — expor alias sincronamente
  window.VOUX_DATA = window.CERES_DATA;

  // Carrega conforme a página atual
  async function boot() {
    try {
      if (!page || page === "index") {
        window.CERES_DATA.admin = await loadAdmin();
      } else if (page === "comercial") {
        window.CERES_DATA.comercial = await loadComercial();
      } else if (page === "pedidos") {
        window.CERES_DATA.pedidos = await loadPedidos();
      } else if (page === "operacional") {
        const d = await loadOperacional();
        window.CERES_DATA.operacional = d;
      } else if (page === "produtos") {
        window.CERES_DATA.produtos = await loadProdutos();
      } else if (page === "servicos") {
        const d = await loadOperacional();
        window.CERES_DATA.servicos = d;
      } else if (page === "acoes") {
        window.CERES_DATA.acoes = await loadAcoes();
      } else if (["overview","consultores","regioes","registros","criticos","mapa","insights","administrativo"].includes(page)) {
        window.CERES_DATA.crm = await loadCRM();
      } else if (page === "negocios-mensais") {
        const [crm, ng] = await Promise.all([loadCRM(), loadNegociosMensais()]);
        window.CERES_DATA.crm = crm;
        window.CERES_DATA.negociosMensais = ng;
      }
    } catch (e) {
      console.warn("[Ceres BI] boot error:", e);
    } finally {
      resolveReady(true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
