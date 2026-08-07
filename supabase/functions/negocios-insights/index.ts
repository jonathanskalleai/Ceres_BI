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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch negocios data
    const { data: negocios } = await supabase
      .from("negocios_mensais")
      .select("consultor,cliente,unidade,pdo_cidade_entrega,valor_pedido,pdo_dth_abertura,ngo_conclusao,ngo_etapa,pdo_situacao_pedido,pdo_obs_pedido,tipo,ngo_motivo_ganho")
      .limit(300);

    // Fetch CRM data for cross-reference
    const { data: crm } = await supabase
      .from("registros_comerciais")
      .select("vendedor,cliente_nome,cidade_cliente,tipo_contato,tipo_acao,negocio_valor,dt_conclusao,obs_final,negocio_etapa")
      .limit(1000);

    // Build summary for AI
    const negSummary = {
      total: negocios?.length || 0,
      totalValor: negocios?.reduce((s, n) => s + (Number(n.valor_pedido) || 0), 0) || 0,
      ganhos: negocios?.filter(n => n.ngo_conclusao === "Ganho").length || 0,
      emAndamento: negocios?.filter(n => n.ngo_conclusao === "Em andamento").length || 0,
      perdidos: negocios?.filter(n => n.ngo_conclusao === "Perdido").length || 0,
      porConsultor: {} as Record<string, { total: number; valor: number; ganhos: number }>,
      porRegiao: {} as Record<string, { total: number; valor: number; ganhos: number }>,
      obsExamples: [] as string[],
    };

    for (const n of (negocios || [])) {
      const c = n.consultor || "Sem consultor";
      if (!negSummary.porConsultor[c]) negSummary.porConsultor[c] = { total: 0, valor: 0, ganhos: 0 };
      negSummary.porConsultor[c].total++;
      negSummary.porConsultor[c].valor += Number(n.valor_pedido) || 0;
      if (n.ngo_conclusao === "Ganho") negSummary.porConsultor[c].ganhos++;

      const r = n.unidade || n.pdo_cidade_entrega || "Sem região";
      if (!negSummary.porRegiao[r]) negSummary.porRegiao[r] = { total: 0, valor: 0, ganhos: 0 };
      negSummary.porRegiao[r].total++;
      negSummary.porRegiao[r].valor += Number(n.valor_pedido) || 0;
      if (n.ngo_conclusao === "Ganho") negSummary.porRegiao[r].ganhos++;

      if (n.pdo_obs_pedido && negSummary.obsExamples.length < 15) {
        negSummary.obsExamples.push(n.pdo_obs_pedido.slice(0, 200));
      }
    }

    // CRM cross-reference summary
    const crmSummary = {
      totalRegistros: crm?.length || 0,
      visitasPorConsultor: {} as Record<string, number>,
    };
    for (const r of (crm || [])) {
      if (r.tipo_contato?.toLowerCase().includes("visita") && r.vendedor) {
        crmSummary.visitasPorConsultor[r.vendedor] = (crmSummary.visitasPorConsultor[r.vendedor] || 0) + 1;
      }
    }

    const prompt = `Você é um analista comercial especializado em equipamentos agrícolas. Analise os dados a seguir e forneça insights acionáveis em português brasileiro.

DADOS DE NEGÓCIOS MENSAIS:
${JSON.stringify(negSummary, null, 1)}

DADOS CRM (VISITAS):
${JSON.stringify(crmSummary, null, 1)}

OBSERVAÇÕES DOS PEDIDOS (exemplos):
${negSummary.obsExamples.join("\n---\n")}

Forneça sua análise no seguinte formato JSON:
{
  "insights": [
    {"titulo": "...", "descricao": "...", "tipo": "padrao|oportunidade|gargalo|acao"}
  ],
  "alertas": [
    {"titulo": "...", "descricao": "...", "severidade": "alta|media|baixa"}
  ],
  "cruzamento_obs": "análise cruzando observações dos pedidos com negócios fechados"
}

Foque em:
1. Padrões de fechamento (quais consultores/regiões convertem mais)
2. Oportunidades (regiões/clientes sub-explorados)
3. Gargalos (muita visita sem venda, consultores com baixa conversão)
4. Sugestões de ações comerciais específicas
5. Cruzamento entre observações finais do CRM e negócios fechados
6. Alertas: queda de performance, regiões com baixa conversão, clientes com alta interação mas baixo fechamento`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Responda SOMENTE com JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_analysis",
            description: "Provide commercial analysis results",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      descricao: { type: "string" },
                      tipo: { type: "string", enum: ["padrao", "oportunidade", "gargalo", "acao"] }
                    },
                    required: ["titulo", "descricao", "tipo"]
                  }
                },
                alertas: {
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
                cruzamento_obs: { type: "string" }
              },
              required: ["insights", "alertas", "cruzamento_obs"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "provide_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const text = await aiResponse.text();
      console.error("AI error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error: " + status);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis;
    if (toolCall?.function?.arguments) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "{}";
      analysis = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, ""));
    }

    return new Response(JSON.stringify(analysis), {
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
