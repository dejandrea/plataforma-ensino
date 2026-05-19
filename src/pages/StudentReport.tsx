import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const StudentReport = () => {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyEvaluations();
  }, []);

  async function fetchMyEvaluations() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Buscamos as avaliações e os dados do módulo relacionado
    const { data, error } = await supabase
      .from('module_evaluations')
      .select(`
        *,
        modules ( title )
      `)
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setEvaluations(data || []);
    setLoading(false);
  }

  if (loading) return <div className="p-10 text-center">Abrindo seu baú de conquistas... 🗝️</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-blue-600 mb-8">Meu Boletim de Inventor 🚀</h1>
      
      {evaluations.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border-2 border-dashed text-center text-gray-400">
          Sua primeira avaliação aparecerá aqui assim que você completar o primeiro módulo!
        </div>
      ) : (
        <div className="grid gap-8">
          {evaluations.map((ev) => (
            <EvaluationCard key={ev.id} evaluation={ev} />
          ))}
        </div>
      )}
    </div>
  );
};

const EvaluationCard = ({ evaluation }: { evaluation: any }) => {
  // Mapeamento de nomes internos para nomes bonitos
  const criteriaLabels: any = {
    score_technical: "Tech",
    score_logic: "Lógica",
    score_creativity: "Criatividade",
    score_autonomy: "Autonomia",
    score_communication: "Troca",
    score_organization: "Organização",
    score_engagement: "Atitude",
    score_patience: "Paciência"
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-blue-100">
      <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
        <h2 className="text-xl font-bold">{evaluation.modules?.title}</h2>
        <span className="bg-blue-400 px-3 py-1 rounded-full text-xs">Finalizado em {new Date(evaluation.created_at).toLocaleDateString()}</span>
      </div>

      <div className="p-6">
        {/* Notas em Estilo Badge */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {Object.keys(criteriaLabels).map((key) => (
            <div key={key} className="bg-gray-50 p-2 rounded-xl text-center border border-gray-100">
              <p className="text-[10px] uppercase font-bold text-gray-400">{criteriaLabels[key]}</p>
              <div className="text-yellow-500 font-bold">
                {"⭐".repeat(evaluation[key])}
              </div>
            </div>
          ))}
        </div>

        {/* Feedback da IA (Onde a mágica do texto aparece) */}
        <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100 mb-4">
          <h3 className="text-purple-700 font-bold mb-2 flex items-center gap-2">
            ✨ Feedback da Inteligência Artificial
          </h3>
          <div className="text-purple-900 text-sm leading-relaxed space-y-2">
            {evaluation.ai_feedback_json ? (
              Object.values(evaluation.ai_feedback_json).map((text: any, i) => (
                <p key={i}>• {text}</p>
              ))
            ) : (
              <p className="italic opacity-60">A IA está processando seus comentários...</p>
            )}
          </div>
        </div>

        {/* Comentário da Professora */}
        <div className="border-t pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Recado da Professora 👩‍🏫</p>
          <p className="text-gray-700 italic">"{evaluation.teacher_comment}"</p>
        </div>
      </div>
    </div>
  );
};