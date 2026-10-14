export function formatEvaluationMonth(month: string) {
  return new Date(`${month.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long", year: "numeric", timeZone: "America/Bahia",
  });
}

export function getEvaluationScope(student: any): "mentoring" | "course" | "both" {
  if (["mentoring", "course", "both"].includes(student?.student_service_scope)) {
    return student.student_service_scope;
  }
  const tracks = new Set((student?.commercial_assignments || []).map((item: any) => item.session_track));
  if (tracks.has("mentoring") && tracks.has("course")) return "both";
  if (tracks.has("mentoring") || student?.pricing_session_track === "mentoring") return "mentoring";
  return "course";
}

export function evaluationTitle(evaluation: any) {
  return evaluation.reference_month
    ? `Mentoria — ${formatEvaluationMonth(evaluation.reference_month)}`
    : evaluation.modules?.title || "Módulo";
}
