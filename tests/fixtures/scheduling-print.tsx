import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {PrintEvaluationButton} from '../../src/components/PrintEvaluationButton';
import {MeetReservationFields} from '../../src/components/MeetSchedulingFields';

// Synthetic data only; the Vite test plugin replaces the Supabase client before modules load.
const state = {defaults: {'student-a': 'https://meet.google.com/abc-defg-hij', 'student-b': null as string | null}};
Object.assign(window, {syntheticMeetDb: state, syntheticClient: {rpc: async (_name: string, args: {p_student_id: string; p_link: string | null}) => {
  state.defaults[args.p_student_id as keyof typeof state.defaults] = args.p_link;
  return {data: args.p_student_id, error: null};
}, from() {
  let student = '', payload: {default_meet_link: string | null} | undefined;
  const query = {select: () => query, eq: (key: string, value: string) => {if(key === 'student_id') student = value; return query;},
    update: (value: typeof payload) => {payload = value; return query;},
    maybeSingle: async () => {if(payload) state.defaults[student as keyof typeof state.defaults] = payload.default_meet_link; return {data: {student_id: student, default_meet_link: state.defaults[student as keyof typeof state.defaults]}, error: null};},
  };return query;
}}});

const scenario = new URLSearchParams(location.search).get('scenario');
const feedback = Object.fromEntries(['technical','logic','creativity','autonomy','communication','organization','engagement','patience'].map(key => [key, 'Demonstra interesse, participa das propostas e explica suas ideias com exemplos.']));
const evaluation = scenario === 'sparse' ? {created_at: '2026-11-01T15:00:00Z', reference_month: '2026-10-01'} : {
  created_at: '2026-11-01T15:00:00Z', reference_month: '2026-10-01',
  ...Object.fromEntries(Object.keys(feedback).map(key => [`score_${key}`, 4])),
  ai_feedback_json: {...feedback, general: 'Evoluiu ao planejar soluções e revisar o próprio trabalho. Demonstra criatividade e colaboração. Recomenda-se continuar praticando a organização dos passos e explicar suas escolhas.'},
  teacher_comment: scenario === 'long' ? Array.from({length: 35}, (_, i) => `Observação ${i+1}: Durante as propostas de criação, explorou diferentes ideias, pediu ajuda quando necessário e revisou sua solução com cuidado. A continuidade das experiências favorece a autonomia e a confiança.`).join('\n\n') + '\nFIM DO COMENTÁRIO LONGO.' : 'Ponto forte: criatividade. A desenvolver: organização das etapas. Recomenda-se prática breve e regular.',
};
function Fixture() {
  const [student, setStudent] = useState('student-a');
  const [choice, setChoice] = useState({meetLink: '', useDefaultMeet: false});
  return scenario === 'meet' ? <main>
    <label>Aluno sintético<select aria-label="Aluno sintético" value={student} onChange={e => setStudent(e.target.value)}><option value="student-a">Aluno A</option><option value="student-b">Aluno B</option></select></label>
    <MeetReservationFields teacherId="teacher" studentId={student} value={choice} onChange={setChoice} />
    <output data-testid="selected-meet">{choice.meetLink}</output>
  </main> : <main><nav>MENU ADMINISTRATIVO DE TESTE</nav><PrintEvaluationButton studentName="Aluno Sintético da Bitaria" evaluation={evaluation} /></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
