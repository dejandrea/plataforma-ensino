import {useId, useState} from 'react';
import schema from '../../contracts/curriculum-matrix.v1.schema.json';
import example from '../../contracts/examples/curriculum-matrix.v1.json';
import instructions from '../../contracts/curriculum-matrix.v1.md?raw';
import {
  confirmMatrix, downloadMatrixFile, exportMatrix, previewMatrix, readMatrix,
  type MatrixAction, type MatrixMode, type MatrixReport, type MatrixRow,
} from '../../lib/curriculumMatrix';

const modes: Record<MatrixMode, string> = {
  create: 'Criar novo curso',
  complement: 'Complementar curso existente',
  update: 'Atualizar curso existente',
};
const actions: Record<MatrixAction, string> = {
  create: 'Criado', complement: 'Complementado', update: 'Atualizado', unchanged: 'Inalterado', conflict: 'Conflito',
};
const prospective: Record<MatrixAction, string> = {
  create: 'Criar', complement: 'Complementar', update: 'Atualizar', unchanged: 'Inalterado', conflict: 'Conflito',
};
const kinds = ['Curso', 'Módulo', 'Submódulo', 'Aula'];
const fields: Record<string, string> = {
  title: 'Título', description: 'Descrição', totalHours: 'Carga horária (h)', orderIndex: 'Ordem',
  durationMinutes: 'Duração (min)', curriculumNumber: 'Número curricular', objectives: 'Objetivos',
};
const inputClass = 'min-w-0 max-w-full rounded-xl bg-gray-900 p-2 text-white ring-1 ring-white/20';
const show = (value: unknown) => value == null || value === '' ? '—' : Array.isArray(value) ? value.join('\n') : String(value);

function MatrixDetails({report, complete}: {report: MatrixReport; complete: boolean}) {
  const labels = complete ? actions : prospective;
  const grouped = new Map<string | null, MatrixRow[]>();
  for (const row of report.rows) {
    const siblings = grouped.get(row.parent) ?? [];
    siblings.push(row);
    grouped.set(row.parent, siblings);
  }

  function renderRows(parent: string | null) {
    return (grouped.get(parent) ?? []).map(row => (
      <details key={row.path} open={row.depth === 0 ? true : undefined} className="my-2 rounded-lg border border-white/15 p-2 sm:p-3">
        <summary className="cursor-pointer break-words">{kinds[row.depth]} · {row.title} · {labels[row.action]}</summary>
        {row.id && <p className="mt-2 break-all text-xs text-white/65">UUID {row.id}</p>}
        {row.match === 'key' && <p className="mt-2 text-xs text-white/65">Correspondência pela chave editorial da aula.</p>}
        {row.match === 'title' && <p className="mt-2 text-xs text-amber-200">Correspondência por título exato no mesmo nível.</p>}
        {!!row.preserved?.length && <p className="mt-2 text-xs text-amber-200">
          Campos preenchidos preservados · {row.preserved.map(key => fields[key] ?? key).join(', ')}
        </p>}
        {row.issue && <p className="mt-2 text-sm text-red-200">{row.issue}</p>}
        {!!Object.keys(row.after).length && <dl className="my-2 space-y-2 text-sm">
          {Object.entries(row.after).map(([key, value]) => <div key={key} className="grid gap-1 break-words sm:grid-cols-3">
            <dt className="font-semibold">{fields[key] ?? key}</dt>
            <dd className="whitespace-pre-wrap text-white/70">Antes · {show(row.before[key])}</dd>
            <dd className="whitespace-pre-wrap">Depois · {show(value)}</dd>
          </div>)}
        </dl>}
        {renderRows(row.path)}
      </details>
    ));
  }

  return <section aria-label={complete ? 'Resultado da importação' : 'Prévia da importação'} className="space-y-3">
    <h3 className="font-bold">{complete ? 'Importação concluída' : 'Prévia'} · {report.courseTitle}</h3>
    <p className="text-sm text-white/75">
      {report.rows.filter(row => row.depth === 1).length} módulo(s) · {report.rows.filter(row => row.depth === 2).length} submódulo(s) · {report.rows.filter(row => row.depth === 3).length} aula(s)
    </p>
    <ul className="flex flex-wrap gap-x-4 text-sm">
      {Object.entries(labels).map(([key, label]) => <li key={key}>{label} · {report.counts[key as MatrixAction] ?? 0}</li>)}
    </ul>
    {report.conflicts.length > 0 && <ul role="alert" className="space-y-1 text-sm text-red-200">
      {report.conflicts.map(conflict => <li key={conflict}>{conflict}</li>)}
    </ul>}
    {renderRows(null)}
  </section>;
}

type Props = {
  courses: {id: string; title: string}[];
  selectedCourseId: string | null;
  onImported: (courseId: string) => void;
};

export function CurriculumMatrix({courses, selectedCourseId, onImported}: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<MatrixMode>('create');
  const [destination, setDestination] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{document: unknown; report: MatrixReport} | null>(null);
  const [result, setResult] = useState<MatrixReport | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const courseId = mode === 'create' ? null : destination;
  const hasChanges = preview?.report.rows.some(row => ['create', 'complement', 'update'].includes(row.action));

  function resetReview() {
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError('');
  }

  async function run(operation: () => Promise<void>) {
    setPending(true);
    setError('');
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.'); }
    finally { setPending(false); }
  }

  return <section aria-label="Matriz curricular" className="space-y-4 rounded-3xl bg-surface p-4 ring-1 ring-white/10 sm:p-6">
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-secondary" aria-expanded={open} aria-controls={panelId} disabled={pending} onClick={() => setOpen(!open)}>Importar matriz curricular</button>
      <button type="button" className="btn-secondary" disabled={!selectedCourseId || pending} onClick={() => {
        if (selectedCourseId) void run(async () => downloadMatrixFile(await exportMatrix(selectedCourseId), `matriz-${selectedCourseId}.json`));
      }}>Exportar matriz curricular</button>
      <button type="button" className="btn-secondary" onClick={() => downloadMatrixFile(example, 'matriz-curricular-modelo.v1.json')}>Baixar modelo e exemplo</button>
      <button type="button" className="btn-secondary" onClick={() => downloadMatrixFile(schema, 'matriz-curricular.v1.schema.json')}>Baixar JSON Schema</button>
      <button type="button" className="btn-secondary" onClick={() => downloadMatrixFile(instructions, 'matriz-curricular.v1.md')}>Instruções de preenchimento</button>
    </div>
    {pending && <p role="status" className="text-sm text-white/75">Processando matriz curricular…</p>}
    {error && <p role="alert" className="break-words text-sm text-red-200">{error}</p>}
    <div id={panelId} hidden={!open} className="space-y-4">
      <fieldset disabled={pending} className="flex flex-wrap items-end gap-3">
        <label className="grid max-w-full gap-1 text-sm">Modo de importação
          <select className={inputClass} value={mode} onChange={event => {
            setMode(event.target.value as MatrixMode);
            if (!destination && selectedCourseId) setDestination(selectedCourseId);
            resetReview();
          }}>
            {Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {mode !== 'create' && <label className="grid max-w-full gap-1 text-sm">Curso de destino
          <select className={inputClass} value={destination} onChange={event => {setDestination(event.target.value); resetReview();}}>
            <option value="">Selecione o curso</option>
            {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>}
        <label className="grid max-w-full gap-1 text-sm">Arquivo JSON
          <input className={inputClass + ' max-w-full'} type="file" accept=".json,application/json"
            onChange={event => {setFile(event.target.files?.[0] ?? null); resetReview();}}/>
        </label>
        <button type="button" className="btn-secondary" disabled={!file || (mode !== 'create' && !courseId)}
          onClick={() => {
            if (!file) return;
            resetReview();
            void run(async () => {
              const document = await readMatrix(file);
              setPreview({document, report: await previewMatrix(mode, courseId, document)});
            });
          }}>Validar e gerar prévia</button>
      </fieldset>
      {preview && <>
        <MatrixDetails report={preview.report} complete={false}/>
        {preview.report.conflicts.length === 0 && (hasChanges ? <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)}/>
            Revisei e autorizo as operações exibidas.
          </label>
          <button type="button" className="btn-primary" disabled={!confirmed || pending} onClick={() => {
            const {document, report: {token}} = preview;
            if (!token) return;
            void run(async () => {
              setPreview(null);
              setConfirmed(false);
              const receipt = await confirmMatrix(mode, courseId, document, token);
              setResult(receipt);
              if (receipt.courseId) onImported(receipt.courseId);
            });
          }}>Confirmar importação</button>
        </div> : <p role="status" className="text-sm text-white/75">A matriz já corresponde ao curso.</p>)}
      </>}
      {result && <MatrixDetails report={result} complete/>}
    </div>
  </section>;
}
