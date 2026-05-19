import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const criteria = [
  { id: "technical", label: "Proficiência Técnica" },
  { id: "logic", label: "Raciocínio Lógico" },
  { id: "creativity", label: "Criatividade" },
  { id: "autonomy", label: "Autonomia" },
  { id: "communication", label: "Comunicação" },
  { id: "organization", label: "Organização e Entrega" },
  { id: "engagement", label: "Engajamento e Atitude" },
  { id: "patience", label: "Paciência" },
];

// Definimos o que o componente precisa receber para funcionar
interface EvaluationFormProps {
  studentId: string;
  moduleId: string;
}

export const EvaluationForm = ({
  studentId,
  moduleId,
}: EvaluationFormProps) => {
  const [scores, setScores] = useState<any>({});
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
  setLoading(true);
  
  try {
    // 1. Chamar a IA para gerar os textos
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('generate-feedback', {
      body: { scores, teacherComment: comment }
    });

    if (aiError) throw new Error("A IA falhou: " + aiError.message);

    // 2. Salvar Notas + Texto da IA no banco
    const { error } = await supabase
      .from('module_evaluations')
      .upsert({
        student_id: studentId,
        module_id: moduleId,
        teacher_comment: comment,
        ai_feedback_json: aiResponse, // O JSON que a IA gerou
        score_technical: scores.technical || 0,
        score_logic: scores.logic || 0,
        score_creativity: scores.creativity || 0,
        score_autonomy: scores.autonomy || 0,
        score_communication: scores.communication || 0,
        score_organization: scores.organization || 0,
        score_engagement: scores.engagement || 0,
        score_patience: scores.patience || 0,
      });

    if (error) throw error;
    alert("Avaliação completa gerada com IA! ✨");
    
  } catch (err: any) {
    alert(err.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-purple-100">
      <h2 className="text-2xl font-bold text-purple-700 mb-6">
        Avaliação Pedagógica 👩‍🏫
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {criteria.map((c) => (
          <div key={c.id} className="flex flex-col">
            <label className="font-medium text-gray-700 mb-2">{c.label}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setScores({ ...scores, [c.id]: star })}
                  className={`text-2xl transition ${scores[c.id] >= star ? "grayscale-0" : "grayscale opacity-30"}`}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea
        className="w-full mt-8 p-4 border rounded-xl outline-none focus:ring-2 focus:ring-purple-400"
        placeholder="Comentário geral sobre o desempenho do aluno..."
        rows={4}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full mt-6 bg-purple-600 text-white py-4 rounded-xl font-bold hover:bg-purple-700 transition shadow-md"
      >
        {loading ? "Processando..." : "Finalizar Avaliação com IA"}
      </button>
    </div>
  );
};
