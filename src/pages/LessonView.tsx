import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const LessonView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  
  // 1. CORREÇÃO: Faltava o estado 'lesson'
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLesson();
    }
  }, [id]);

  async function fetchLesson() {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error("Erro do Supabase:", error.message);
    }
    
    setLesson(data);
  }

  const handleMarkAsComplete = async () => {
  setLoading(true);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("Ops! Você precisa estar logado! 🔑");
    setLoading(false);
    return;
  }

  // TENTATIVA DE SALVAR
  const { error } = await supabase
    .from('student_progress')
    .upsert({ 
      student_id: user?.id, 
      lesson_id: id,
      completed_at: new Date().toISOString() // Adicionei a data explicitamente
    });

  if (error) {
    // DICA DE MENTOR: O LOG ABAIXO VAI TE DIZER O MOTIVO REAL NO CONSOLE (F12)
    console.error("DETALHE DO ERRO:", error.message, error.details, error.hint);
    alert("Erro ao salvar: " + error.message); 
  } else {
    alert("Parabéns! Você concluiu essa aula! 🏆");
    navigate('/dashboard');
  }
  setLoading(false);
};

  // 3. EXPLICAÇÃO: Removi a função 'handleComplete' duplicada para limpar o código.

  if (!lesson) return <div className="p-10 text-center">Carregando conteúdo... ⏳</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <button 
        onClick={() => navigate('/dashboard')}
        className="mb-6 text-blue-600 hover:underline flex items-center font-medium"
      >
        ⬅️ Voltar para a Dashboard
      </button>

      <h1 className="text-3xl font-bold mb-4 text-gray-800">{lesson.title}</h1>

      {/* Container do Vídeo */}
      <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-xl mb-8">
        {lesson.video_url ? (
          <iframe
            className="w-full h-full"
            src={lesson.video_url.replace('watch?v=', 'embed/')}
            title="Vídeo da aula"
            allowFullScreen
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            Vídeo não disponível 🎬
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-semibold mb-3 text-gray-700">Materiais da Aula</h3>
        {lesson.pdf_url ? (
          <a 
            href={lesson.pdf_url} 
            target="_blank" 
            rel="noreferrer"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            📥 Baixar Material (PDF/Slides)
          </a>
        ) : (
          <p className="text-gray-500 italic">Esta aula não possui materiais extras.</p>
        )}
      </div>

      <div className="mt-10 border-t pt-6 mb-20">
        <button 
          onClick={handleMarkAsComplete}
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg text-lg
            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 active:scale-95'}`}
        >
          {loading ? 'Salvando conquista...' : 'CONCLUIR AULA E GANHAR XP! 🚀'}
        </button>
      </div>
    </div>
  );
};