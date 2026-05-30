import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Parse optional consultor filter from request body
    let targetConsultor: string | null = null;
    try {
      const body = await req.json();
      if (body?.consultor) targetConsultor = body.consultor;
    } catch { /* no body */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ADMIN_USERS = [
      "camila esser colet", "ana paula", "daniel cesar canoth",
      "mathias henrique montinelli picinato", "tainara trevisa", "tainara trevisan",
      "alex paulo ranzan", "alex ranzan", "andre candiotto",
    ];
    const isAdmin = (name: string | null) => {
      if (!name) return false;
      const normalized = name.trim().toLowerCase().replace(/\s+- .+$/, "");
      return ADMIN_USERS.some(a => a === normalized || normalized.includes(a) || a.includes(normalized));
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dtInicio = thirtyDaysAgo.toISOString().split("T")[0];
    const dtFim = now.toISOString().split("T")[0];

    // Fetch negocios in period
    const allNegocios: any[] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabase
        .from("negocios_mensais")
        .select("consultor,cliente,unidade,pdo_cidade_entrega,valor_pedido,pdo_dth_abertura,ngo_conclusao,ngo_etapa,tipo,ngo_motivo_ganho,pdo_obs_pedido")
        .gte("pdo_dth_abertura", dtInicio)
        .lte("pdo_dth_abertura", dtFim);
      if (targetConsultor) query = query.eq("consultor", targetConsultor);
      const { data } = await query.range(from, from + 999);
      allNegocios.push(...(data || []));
      if ((data || []).length < 1000) break;
    }

    // Fetch CRM in period
    const allCrm: any[] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabase
        .from("registros_comerciais")
        .select("vendedor,cliente_nome,cidade_cliente,tipo_contato,tipo_acao,negocio_valor,dt_conclusao,obs_final,negocio_etapa")
        .gte("dt_conclusao", dtInicio)
        .lte("dt_conclusao", dtFim);
      if (targetConsultor) query = query.eq("vendedor", targetConsultor);
      const { data } = await query.range(from, from + 999);
      allCrm.push(...(data || []));
      if ((data || []).length < 1000) break;
    }

    // Build per-consultant stats
    const consultorStats: Record<string, {
      acoes: number; visitas: number; negocios: number; valorTotal: number;
      ganhos: number; perdidos: number; emAndamento: number;
      clientesSet: Set<string>; clientesAtendidosSet: Set<string>;
      obsPositivas: string[]; obsNegativas: string[];
      tiposAcao: Record<string, number>;
      cidadesAtendidas: Set<string>;
    }> = {};

    const posKw = ["venda","negócio","interesse","fechamento","pedido","aprovado","fechou","satisfeito","comprar","gostou"];
    const negKw = ["não","problema","cancelar","desistiu","reclamação","caro","concorrência","sem interesse","parado","defeito"];

    for (const r of allCrm) {
      if (!targetConsultor && isAdmin(r.vendedor)) continue;
      const v = r.vendedor || "Sem consultor";
      if (!consultorStats[v]) consultorStats[v] = { acoes: 0, visitas: 0, negocios: 0, valorTotal: 0, ganhos: 0, perdidos: 0, emAndamento: 0, clientesSet: new Set(), clientesAtendidosSet: new Set(), obsPositivas: [], obsNegativas: [], tiposAcao: {}, cidadesAtendidas: new Set() };
      const s = consultorStats[v];
      s.acoes++;
      if (r.tipo_contato?.toLowerCase().includes("visita")) s.visitas++;
      if (r.cliente_nome) s.clientesAtendidosSet.add(r.cliente_nome);
      if (r.cidade_cliente) s.cidadesAtendidas.add(r.cidade_cliente);
      if (r.tipo_acao) s.tiposAcao[r.tipo_acao] = (s.tiposAcao[r.tipo_acao] || 0) + 1;
      if (r.obs_final) {
        const low = r.obs_final.toLowerCase();
        const maxObs = targetConsultor ? 8 : 3;
        if (posKw.some(k => low.includes(k)) && s.obsPositivas.length < maxObs) s.obsPositivas.push(r.obs_final.slice(0, 200));
        if (negKw.some(k => low.includes(k)) && s.obsNegativas.length < maxObs) s.obsNegativas.push(r.obs_final.slice(0, 200));
      }
    }

    for (const n of allNegocios) {
      if (!targetConsultor && isAdmin(n.consultor)) continue;
      const v = n.consultor || "Sem consultor";
      if (!consultorStats[v]) consultorStats[v] = { acoes: 0, visitas: 0, negocios: 0, valorTotal: 0, ganhos: 0, perdidos: 0, emAndamento: 0, clientesSet: new Set(), clientesAtendidosSet: new Set(), obsPositivas: [], obsNegativas: [], tiposAcao: {}, cidadesAtendidas: new Set() };
      const s = consultorStats[v];
      s.negocios++;
      s.valorTotal += Number(n.valor_pedido) || 0;
      if (n.cliente) s.clientesSet.add(n.cliente);
      if (n.ngo_conclusao === "Ganho") s.ganhos++;
      else if (n.ngo_conclusao === "Perdido") s.perdidos++;
      else s.emAndamento++;
    }

    const consultorData = Object.entries(consultorStats).map(([nome, s]) => ({
      nome,
      acoes: s.acoes,
      visitas: s.visitas,
      negocios: s.negocios,
      valorTotal: s.valorTotal,
      ganhos: s.ganhos,
      perdidos: s.perdidos,
      emAndamento: s.emAndamento,
      clientesNegocio: s.clientesSet.size,
      clientesAtendidos: s.clientesAtendidosSet.size,
      taxaConversao: s.clientesAtendidosSet.size > 0 ? Math.round((s.negocios / s.clientesAtendidosSet.size) * 100) : 0,
      ticketMedio: s.negocios > 0 ? Math.round(s.valorTotal / s.negocios) : 0,
      eficiencia: s.visitas > 0 ? Math.round((s.ganhos / s.visitas) * 100) : 0,
      obsPositivas: s.obsPositivas,
      obsNegativas: s.obsNegativas,
      tiposAcao: s.tiposAcao,
      cidadesAtendidas: Array.from(s.cidadesAtendidas),
    })).sort((a, b) => b.valorTotal - a.valorTotal);

    const regiaoMap: Record<string, { total: number; valor: number; ganhos: number }> = {};
    for (const n of allNegocios) {
      const r = n.unidade || n.pdo_cidade_entrega || "Sem região";
      if (!regiaoMap[r]) regiaoMap[r] = { total: 0, valor: 0, ganhos: 0 };
      regiaoMap[r].total++;
      regiaoMap[r].valor += Number(n.valor_pedido) || 0;
      if (n.ngo_conclusao === "Ganho") regiaoMap[r].ganhos++;
    }

    const totais = {
      negocios: allNegocios.length,
      valorTotal: allNegocios.reduce((s, n) => s + (Number(n.valor_pedido) || 0), 0),
      ganhos: allNegocios.filter(n => n.ngo_conclusao === "Ganho").length,
      perdidos: allNegocios.filter(n => n.ngo_conclusao === "Perdido").length,
      emAndamento: allNegocios.filter(n => n.ngo_conclusao === "Em andamento").length,
      acoesCRM: allCrm.length,
      visitasCRM: allCrm.filter(r => r.tipo_contato?.toLowerCase().includes("visita")).length,
      clientesAtendidos: new Set(allCrm.map(r => r.cliente_nome).filter(Boolean)).size,
    };

    // Build prompt - individual vs team
    let prompt: string;
    if (targetConsultor && consultorData.length > 0) {
      const c = consultorData[0];
      prompt = `Você é um diretor comercial experiente em equipamentos agrícolas. Analise os dados INDIVIDUAIS do consultor "${targetConsultor}" no período de ${dtInicio} a ${dtFim} (últimos 30 dias) e produza um relatório executivo detalhado e personalizado em português brasileiro.

DADOS DO CONSULTOR "${targetConsultor}":
${JSON.stringify(c, null, 1)}

DADOS TOTAIS DA EQUIPE NO MESMO PERÍODO (para referência comparativa):
${JSON.stringify(totais)}

PERFORMANCE POR REGIÃO DO CONSULTOR:
${JSON.stringify(Object.entries(regiaoMap).map(([r, v]) => ({ regiao: r, ...v })).sort((a, b) => b.valor - a.valor).slice(0, 10))}

Gere o relatório FOCADO EXCLUSIVAMENTE no consultor "${targetConsultor}". Compare sua performance com as médias da equipe. Analise detalhadamente:
- Tipos de ações realizadas e frequência
- Clientes atendidos e cidades visitadas  
- Observações positivas e negativas registradas no CRM
- Taxa de conversão e eficiência
- Pontos fortes e fracos específicos
- Recomendações personalizadas para melhoria

Use linguagem profissional de gestão comercial. Seja específico e detalhado.`;
    } else {
      prompt = `Você é um diretor comercial experiente em equipamentos agrícolas. Analise os dados do período de ${dtInicio} a ${dtFim} (últimos 30 dias) e produza um relatório executivo completo em português brasileiro.

DADOS TOTAIS DO PERÍODO:
${JSON.stringify(totais)}

PERFORMANCE POR CONSULTOR:
${JSON.stringify(consultorData, null, 1)}

PERFORMANCE POR REGIÃO:
${JSON.stringify(Object.entries(regiaoMap).map(([r, v]) => ({ regiao: r, ...v })).sort((a, b) => b.valor - a.valor).slice(0, 15))}

Gere o relatório no formato JSON a seguir. Seja detalhado, cite nomes de consultores, valores e percentuais. Use linguagem profissional de gestão comercial.`;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Responda SOMENTE com o JSON estruturado conforme a tool function. Seja extremamente detalhado e profissional." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_report",
            description: "Generate executive commercial report",
            parameters: {
              type: "object",
              properties: {
                resumo_executivo: {
                  type: "object",
                  properties: {
                    visao_geral: { type: "string" },
                    destaques_positivos: { type: "array", items: { type: "string" } },
                    destaques_negativos: { type: "array", items: { type: "string" } },
                    conclusoes: { type: "array", items: { type: "string" } },
                    palavras_chave_positivas: { type: "array", items: { type: "string" } },
                    palavras_chave_negativas: { type: "array", items: { type: "string" } },
                  },
                  required: ["visao_geral", "destaques_positivos", "destaques_negativos", "conclusoes"]
                },
                analise_consultores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string" },
                      classificacao: { type: "string", enum: ["Alta performance", "Performance média", "Baixa performance"] },
                      analise: { type: "string" },
                      pontos_fortes: { type: "array", items: { type: "string" } },
                      pontos_fracos: { type: "array", items: { type: "string" } },
                    },
                    required: ["nome", "classificacao", "analise"]
                  }
                },
                pontos_atencao: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      descricao: { type: "string" },
                      severidade: { type: "string", enum: ["alta", "media", "baixa"] }
                    },
                    required: ["titulo", "descricao", "severidade"]
                  }
                },
                oportunidades: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      descricao: { type: "string" }
                    },
                    required: ["titulo", "descricao"]
                  }
                },
                insights_ia: {
                  type: "object",
                  properties: {
                    padroes: { type: "array", items: { type: "string" } },
                    tendencias: { type: "array", items: { type: "string" } },
                    previsoes: { type: "array", items: { type: "string" } },
                  },
                  required: ["padroes", "tendencias", "previsoes"]
                },
                recomendacoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      descricao: { type: "string" },
                      prioridade: { type: "string", enum: ["alta", "media", "baixa"] }
                    },
                    required: ["titulo", "descricao", "prioridade"]
                  }
                },
                plano_acao: {
                  type: "object",
                  properties: {
                    acoes_gestor: { type: "array", items: { type: "string" } },
                    acoes_consultores: { type: "array", items: { type: "string" } },
                    prioridades_curto_prazo: { type: "array", items: { type: "string" } },
                  },
                  required: ["acoes_gestor", "acoes_consultores", "prioridades_curto_prazo"]
                },
              },
              required: ["resumo_executivo", "analise_consultores", "pontos_atencao", "oportunidades", "insights_ia", "recomendacoes", "plano_acao"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_report" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const text = await aiResponse.text();
      console.error("AI error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error: " + status);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let report;
    if (toolCall?.function?.arguments) {
      report = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "{}";
      report = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, ""));
    }

    // Attach raw stats for PDF
    report._stats = {
      periodo: { inicio: dtInicio, fim: dtFim },
      totais,
      consultores: consultorData,
      regioes: Object.entries(regiaoMap).map(([r, v]) => ({ regiao: r, ...v })).sort((a, b) => b.valor - a.valor).slice(0, 10),
      individual: targetConsultor || null,
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
