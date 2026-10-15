import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedProfile } from "../_shared/supabase.ts";
import { parseManualLesson } from "../_shared/manual-lesson.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Método não permitido." }, { status: 405, headers: corsHeaders });
  try {
    const { adminClient, user, profile } = await getAuthenticatedProfile(req);
    if (profile.role !== "admin") return Response.json({ error: "Somente a gestão pode registrar aulas manualmente." }, { status: 403, headers: corsHeaders });
    const { data: actor, error: actorError } = await adminClient.from("profiles").select("is_active").eq("id", user.id).single();
    if (actorError || !actor?.is_active) return Response.json({ error: "Seu acesso está inativo." }, { status: 403, headers: corsHeaders });

    const record = parseManualLesson(await req.json());
    const [{ data: student, error: studentError }, { data: teacher, error: teacherError }] = await Promise.all([
      adminClient.from("profiles").select("id, role").eq("id", record.student_id).single(),
      adminClient.from("profiles").select("id, role").eq("id", record.teacher_id).single(),
    ]);
    if (studentError || student?.role !== "student") throw new Error("Aluno não encontrado.");
    if (teacherError || !["admin", "professor"].includes(teacher?.role)) throw new Error("Professora não encontrada.");
    const { data: lesson, error } = await adminClient.from("scheduled_lessons").insert({
      ...record,
      status: "completed",
      calendar_provider: "manual",
      created_by: user.id,
      completed_by: user.id,
      completed_at: record.ends_at,
    }).select("*").single();
    if (error?.code === "23505") {
      // A retry after a lost response must not create another billable lesson.
      const { data: existing, error: existingError } = await adminClient.from("scheduled_lessons").select("*")
        .eq("id", record.id).eq("created_by", user.id).eq("calendar_provider", "manual").single();
      if (!existingError && existing) return Response.json({ lesson: existing }, { headers: corsHeaders });
    }
    if (error) throw new Error("Não foi possível registrar a aula. Tente novamente.");
    return Response.json({ lesson }, { status: 201, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao registrar aula." }, { status: 400, headers: corsHeaders });
  }
});
