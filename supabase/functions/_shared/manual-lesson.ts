const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const parseManualLesson = (body: unknown, now = Date.now()) => {
  if (!body || typeof body !== "object") throw new Error("Informe os dados da aula.");
  const input = body as Record<string, unknown>;
  for (const field of ["requestId", "studentId", "teacherId"]) {
    if (typeof input[field] !== "string" || !uuidPattern.test(input[field])) {
      throw new Error("Selecione o aluno e a professora e tente novamente.");
    }
  }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!title || title.length > 200) throw new Error("Informe um título com até 200 caracteres.");
  if (description.length > 5000) throw new Error("As observações devem ter até 5.000 caracteres.");
  if (input.sessionTrack !== "mentoring" && input.sessionTrack !== "course") throw new Error("Selecione o tipo da aula.");
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (typeof input.startsAt !== "string" || typeof input.endsAt !== "string"
    || !timestamp.test(input.startsAt) || !timestamp.test(input.endsAt)) throw new Error("Informe horários com fuso horário.");
  const start = new Date(input.startsAt).getTime();
  const end = new Date(input.endsAt).getTime();
  for (const value of [input.startsAt, input.endsAt]) {
    const day = value.slice(0, 10);
    const normalizedDay = new Date(`${day}T12:00:00Z`);
    if (!Number.isFinite(normalizedDay.getTime()) || normalizedDay.toISOString().slice(0, 10) !== day
      || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59) {
      throw new Error("Informe uma data e horários válidos.");
    }
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("O término deve ser posterior ao início.");
  if (end > now) throw new Error("Registre somente aulas já realizadas.");
  if (end - start > 24 * 3_600_000) throw new Error("A duração não pode ultrapassar 24 horas.");
  return {
    id: input.requestId as string,
    student_id: input.studentId as string,
    teacher_id: input.teacherId as string,
    title,
    description: description || null,
    session_track: input.sessionTrack,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
  };
};
