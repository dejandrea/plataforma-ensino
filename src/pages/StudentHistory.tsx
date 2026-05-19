import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export const StudentHistory = () => {
  const { studentId } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [studentId]);

  async function fetchData() {
    setLoading(true);
    // 1. Busca os dados básicos do aluno
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .single();

    // 2. Busca todas as avaliações deste aluno
    const { data: evals, error } = await supabase
      .from('module_evaluations')
      .select(`
        *,
        modules ( title )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) console.error("Erro ao buscar histórico:", error);
    
    setStudent(profile);
    setEvaluations(evals || []);
    setLoading(false);
  }

  if (loading) return <div className="p-10 text-center">Carregando jornada do aluno...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/dashboard-professor" className="text-blue-600 hover:underline mb-6 inline-block">
        ← Voltar para Meus Alunos
      </Link>

      {/* Cabeçalho do Aluno */}
      <header className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8 flex items-center gap-6">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold shadow-lg">
          {student?.full_name?.charAt(0)}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{student?.full_name}</h1>
          <p className="text-gray-500 font-medium">Histórico de Aprendizagem</p>
          <div className="mt-2 inline-block bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            {evaluations.length} Módulos Concluídos
          </div>
        </div>
      </header>

      {/* Lista de Avaliações */}
      <div className="space-y-6">
        {evaluations.length === 0 ? (
          <div className="bg-gray-50 p-12 text-center rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">Nenhuma avaliação encontrada para este aluno.</p>
            <Link to={`/admin/avaliar`} className="mt-4 inline-block text-blue-600 font-bold">Avaliar agora →</Link>
          </div>
        ) : (
          evaluations.map((item) => (
            <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{item.modules?.title}</h3>
                  <p className="text-sm text-gray-400">Realizado em {new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Grid de Notas (Estrelas) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Lógica', val: item.score_logic },
                  { label: 'Criatividade', val: item.score_creativity },
                  { label: 'Autonomia', val: item.score_autonomy },
                  { label: 'Comunicação', val: item.score_communication }
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-50 p-3 rounded-xl text-center">
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{stat.label}</p>
                    <p className="text-sm">{"⭐".repeat(stat.val)}</p>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-sm text-blue-900 leading-relaxed">
                  <span className="font-bold">Comentário da Professora:</span><br/>
                  "{item.teacher_comment}"
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};