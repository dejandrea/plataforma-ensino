import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export const ManualLessonForm = ({ students, teachers, onSaved, onCancel }: {
  students: { id: string; full_name: string }[];
  teachers: { id: string; fullName: string }[];
  onSaved: (lesson: { id: string }) => void;
  onCancel: () => void;
}) => {
  const [requestId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({ studentId: "", teacherId: "", title: "", sessionTrack: "mentoring", date: "", start: "", end: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const patch = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const startsAt = `${form.date}T${form.start}:00-03:00`;
    const endsAt = `${form.date}T${form.end}:00-03:00`;
    if (!form.title.trim() || !form.studentId || !form.teacherId || !Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt))) {
      setErrorMessage("Preencha o aluno, a professora, o título e os horários."); return;
    }
    if (Date.parse(endsAt) <= Date.parse(startsAt)) { setErrorMessage("O término deve ser posterior ao início."); return; }
    if (Date.parse(endsAt) > Date.now()) { setErrorMessage("Registre somente aulas já realizadas."); return; }
    setSaving(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("create-manual-lesson", { body: {
        requestId, studentId: form.studentId, teacherId: form.teacherId, title: form.title,
        sessionTrack: form.sessionTrack, description: form.description, startsAt, endsAt,
      } });
      if (error) throw error;
      if (!data?.lesson?.id) throw new Error("Não foi possível confirmar o registro da aula.");
      onSaved(data.lesson);
    } catch (error) {
      let message = error instanceof Error ? error.message : "Erro ao registrar aula.";
      if (error instanceof FunctionsHttpError) {
        const response = await error.context.json().catch(() => null);
        message = response?.error || message;
      }
      setErrorMessage(message);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="mt-5 space-y-4 rounded-2xl bg-background p-5 ring-1 ring-white/10">
      <h3 className="text-xl font-bold">Registrar aula realizada</h3>
      <p className="text-sm text-brand-200">A aula será concluída e incluída no histórico e no financeiro. Horários de Brasília/Bahia (UTC−3).</p>
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">Aluno<select className="input" required value={form.studentId} onChange={(event) => patch("studentId", event.target.value)}><option value="">Selecione</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></label>
        <label className="grid gap-2 text-sm">Professora responsável<select className="input" required value={form.teacherId} onChange={(event) => patch("teacherId", event.target.value)}><option value="">Selecione</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
        <label className="grid gap-2 text-sm">Título<input className="input" required maxLength={200} value={form.title} onChange={(event) => patch("title", event.target.value)} /></label>
        <label className="grid gap-2 text-sm">Tipo<select className="input" value={form.sessionTrack} onChange={(event) => patch("sessionTrack", event.target.value)}><option value="mentoring">Mentoria</option><option value="course">Curso</option></select></label>
        <label className="grid gap-2 text-sm">Data da aula<input className="input" required type="date" value={form.date} onChange={(event) => patch("date", event.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm">Início<input className="input" required type="time" value={form.start} onChange={(event) => patch("start", event.target.value)} /></label>
          <label className="grid gap-2 text-sm">Término<input className="input" required type="time" value={form.end} onChange={(event) => patch("end", event.target.value)} /></label>
        </div>
        <label className="grid gap-2 text-sm sm:col-span-2">Observações (opcional)<textarea className="input min-h-24" maxLength={5000} value={form.description} onChange={(event) => patch("description", event.target.value)} /></label>
      </fieldset>
      {errorMessage && <p className="text-sm text-rose-300" role="alert">{errorMessage}</p>}
      <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={saving}>{saving ? "Registrando..." : "Registrar aula concluída"}</button><button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>Cancelar</button></div>
    </form>
  );
};
