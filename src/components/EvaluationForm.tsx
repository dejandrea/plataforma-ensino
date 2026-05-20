import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const criteria = [
  { id: "technical", label: "Proficiencia Tecnica" },
  { id: "logic", label: "Raciocinio Logico" },
  { id: "creativity", label: "Criatividade" },
  { id: "autonomy", label: "Autonomia" },
  { id: "communication", label: "Comunicacao" },
  { id: "organization", label: "Organizacao e Entrega" },
  { id: "engagement", label: "Engajamento e Atitude" },
  { id: "patience", label: "Paciencia" },
];

interface EvaluationFormProps {
  studentId: string;
  moduleId: string;
}

const expectedFeedbackKeys = [
  "technical",
  "logic",
  "creativity",
  "autonomy",
  "communication",
  "organization",
  "engagement",
  "patience",
];

export const EvaluationForm = ({
  studentId,
  moduleId,
}: EvaluationFormProps) => {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const { data: aiResponse, error: aiError } =
        await supabase.functions.invoke("generate-feedback", {
          body: { scores, teacherComment: comment },
        });

      if (aiError) {
        throw new Error("A geração com IA falhou: " + aiError.message);
      }

      if (!aiResponse || typeof aiResponse !== "object") {
        throw new Error("A IA não retornou um JSON válido.");
      }

      if ("error" in aiResponse) {
        throw new Error(String(aiResponse.error));
      }

      const hasAllExpectedKeys = expectedFeedbackKeys.every(
        (key) => typeof aiResponse[key] === "string" && aiResponse[key].trim(),
      );

      if (!hasAllExpectedKeys) {
        throw new Error("A IA retornou um feedback incompleto.");
      }

      const { error } = await supabase.from("module_evaluations").upsert({
        student_id: studentId,
        module_id: moduleId,
        teacher_comment: comment,
        ai_feedback_json: aiResponse,
        score_technical: scores.technical || 0,
        score_logic: scores.logic || 0,
        score_creativity: scores.creativity || 0,
        score_autonomy: scores.autonomy || 0,
        score_communication: scores.communication || 0,
        score_organization: scores.organization || 0,
        score_engagement: scores.engagement || 0,
        score_patience: scores.patience || 0,
      });

      if (error) {
        throw error;
      }

      alert("Avaliacao completa gerada com IA.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-purple-100">
      <h2 className="text-2xl font-bold text-purple-700 mb-6">
        Avaliacao pedagogica
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {criteria.map((criterion) => (
          <div key={criterion.id} className="flex flex-col">
            <label className="font-medium text-gray-700 mb-2">
              {criterion.label}
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setScores({ ...scores, [criterion.id]: star })}
                  className={`text-2xl transition ${
                    scores[criterion.id] >= star
                      ? "grayscale-0"
                      : "grayscale opacity-30"
                  }`}
                  type="button"
                >
                  *
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea
        className="w-full mt-8 p-4 border rounded-xl outline-none focus:ring-2 focus:ring-purple-400"
        placeholder="Comentario geral sobre o desempenho do aluno..."
        rows={4}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full mt-6 bg-purple-600 text-white py-4 rounded-xl font-bold hover:bg-purple-700 transition shadow-md disabled:opacity-50"
        type="button"
      >
        {loading ? "Processando..." : "Finalizar avaliacao com IA"}
      </button>
    </div>
  );
};
