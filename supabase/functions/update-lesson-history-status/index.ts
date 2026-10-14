import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);
    if (profile.role !== "admin" && profile.role !== "professor") {
      throw new Error("Você não tem permissão para alterar o histórico de aulas.");
    }
    const { lessonId, status } = await req.json();
    if (typeof lessonId !== "string" || !lessonId || !["completed", "cancelled"].includes(status)) {
      throw new Error("Informe uma aula e um status válido.");
    }
    const { data: lesson, error: lookupError } = await adminClient.from("scheduled_lessons")
      .select("id, teacher_id, status").eq("id", lessonId).single();
    if (lookupError || !lesson) throw new Error("Aula não encontrada.");
    if (profile.role !== "admin" && lesson.teacher_id !== user.id) {
      throw new Error("Você só pode alterar o histórico das suas aulas.");
    }
    if (!["completed", "cancelled"].includes(lesson.status)) {
      throw new Error("Esta aula não pertence ao histórico de concluídas ou canceladas.");
    }
    if (lesson.status === status) {
      return Response.json({ lesson }, { headers: corsHeaders });
    }
    const timestamp = new Date().toISOString();
    const { data, error } = await adminClient.from("scheduled_lessons").update({
      status,
      completed_at: status === "completed" ? timestamp : null,
      completed_by: status === "completed" ? user.id : null,
      cancelled_at: status === "cancelled" ? timestamp : null,
      updated_at: timestamp,
    }).eq("id", lesson.id).eq("status", lesson.status).select("*").single();
    if (error) throw new Error("Não foi possível atualizar a aula. Atualize a página e tente novamente.");
    return Response.json({ lesson: data }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao atualizar aula." }, {
      status: 400, headers: corsHeaders,
    });
  }
});
