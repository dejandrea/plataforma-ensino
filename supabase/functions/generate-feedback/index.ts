import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("Chave OPENAI_API_KEY não configurada.");

    const { scores, teacherComment } = await req.json();

    const prompt = `Você é uma professora de tecnologia acolhedora. Com base nas notas ${JSON.stringify(scores)} e no comentário "${teacherComment}", gere um feedback motivador em JSON. 
    Use EXATAMENTE estas chaves: technical, logic, creativity, autonomy, communication, organization, engagement, patience.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um assistente que responde apenas em JSON puro." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }, // Garante o formato JSON nativo
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (data.error) throw new Error(`OpenAI Erro: ${data.error.message}`);

    // Na OpenAI, o conteúdo vem limpo dentro de choices[0].message.content
    const feedbackJson = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(feedbackJson), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});