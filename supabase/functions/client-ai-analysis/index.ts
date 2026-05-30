import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clienteNome, vendedorNome, acoes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const acoesTexto = acoes.map((a: any, i: number) =>
      `${i + 1}. Data: ${a.dtConclusao || "N/A"} | Tipo Contato: ${a.tipoContato || "N/A"} | Tipo Ação: ${a.tipoAcao || "N/A"} | Valor Negócio: R$ ${(a.negocioValor || 0).toLocaleString("pt-BR")} | Etapa: ${a.negocioEtapa || "N/A"} | Obs: ${a.obs || "Sem observação"}`
    ).join("\n");

    const systemPrompt = `Você é um analista comercial sênior do setor de máquinas e equipamentos agrícolas. 
Analise os dados do cliente e forneça insights acionáveis em português brasileiro.
Seja direto, pragmático e focado em resultado.
Responda em formato estruturado com:
1. **Resumo do Cliente** (2-3 frases sobre o perfil e comportamento)
2. **Diagnóstico** (pontos fortes e fracos do relacionamento)
3. **Recomendações** (3-4 ações concretas e específicas para o consultor executar)

NÃO use emojis excessivos. Seja profissional mas objetivo.`;

    const userPrompt = `Analise o cliente "${clienteNome}" atendido pelo consultor "${vendedorNome}".

Últimas ações registradas:
${acoesTexto || "Nenhuma ação recente encontrada."}

Com base nessas informações, forneça o resumo, diagnóstico e recomendações.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione fundos na sua conta." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "Não foi possível gerar análise.";

    return new Response(JSON.stringify({ analysis: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("client-ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
