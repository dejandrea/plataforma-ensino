/** Canonical Google Meet URLs only. Never accept redirects, credentials or arbitrary hosts. */
export function normalizeMeetLink(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Informe um link válido do Google Meet.');
  const text = value.trim();
  if (!text) return null;
  if (!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(text)) {
    throw new Error('Use um endereço como https://meet.google.com/abc-defg-hij.');
  }
  return text.replace(/\/$/, '');
}

export function chooseNewLessonMeet(existing: string | null, explicit: unknown, preferred: string | null, useDefault = true, confirmed = false) {
  const supplied = explicit === undefined ? undefined : normalizeMeetLink(explicit);
  // Empty input does not silently erase an existing room.
  if (existing && supplied && supplied !== existing && !confirmed) throw new Error('Confirme a substituição do link existente desta aula.');
  return supplied || existing || (useDefault ? normalizeMeetLink(preferred) : null);
}

export async function studentMeetPreference(client: any, teacherId: string, studentId: string) {
  const {data, error} = await client.from('teacher_student_relations').select('default_meet_link')
    .eq('teacher_id', teacherId).eq('student_id', studentId).maybeSingle();
  if (error) throw new Error('Não foi possível consultar o link padrão do aluno. Confira a preparação do ambiente.');
  return normalizeMeetLink(data?.default_meet_link);
}
