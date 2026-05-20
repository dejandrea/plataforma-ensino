import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY não configurada nas secrets da função.");
    }

    const { scores, teacherComment } = await req.json();
    if (!scores || typeof scores !== "object") {
      throw new Error("Payload inválido: 'scores' é obrigatório.");
    }

    const prompt = `
Você é uma professora de tecnologia acolhedora.
Com base nas notas ${JSON.stringify(scores)} e no comentário "${teacherComment ?? ""}",
gere um feedback motivador em JSON.
Use exatamente estas chaves:
technical, logic, creativity, autonomy, communication, organization, engagement, patience.
Cada valor deve ser uma frase curta em português do Brasil.
`.trim();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente que responde apenas com JSON puro e válido.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    const rawText = await response.text();
    let data: any;

    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error("A OpenAI retornou uma resposta não-JSON.");
    }

    if (!response.ok) {
      throw new Error(data?.error?.message || "Erro ao chamar a OpenAI.");
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("A OpenAI não retornou conteúdo para o feedback.");
    }

    const feedbackJson = JSON.parse(content);

    return new Response(JSON.stringify(feedbackJson), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
