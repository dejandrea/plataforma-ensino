export const StudentFeedback = ({ evaluation }: { evaluation: any }) => {
  if (!evaluation) return null;

  const hasAiFeedback =
    evaluation.ai_feedback_json &&
    typeof evaluation.ai_feedback_json === "object" &&
    !Array.isArray(evaluation.ai_feedback_json) &&
    !("error" in evaluation.ai_feedback_json);

  const aiFeedbacks = hasAiFeedback
    ? Object.entries(evaluation.ai_feedback_json)
    : [];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-2xl shadow-inner border border-white">
      <h3 className="text-xl font-bold text-blue-700 mb-4 flex items-center gap-2">
        <span>*</span> Seu desempenho no modulo
      </h3>

      <div className="space-y-4">
        {aiFeedbacks.length > 0 ? (
          aiFeedbacks.map(([key, text]: any) => (
            <div key={key} className="bg-white/80 p-3 rounded-lg border border-blue-100">
              <span className="text-xs font-bold uppercase text-blue-400">{key}</span>
              <p className="text-gray-700 text-sm">{text}</p>
            </div>
          ))
        ) : (
          <div className="bg-white/80 p-4 rounded-lg border border-blue-100">
            <p className="text-xs font-bold uppercase text-blue-400">
              Feedback da professora
            </p>
            <p className="text-gray-700 text-sm">
              {evaluation.teacher_comment || "Nenhum comentario foi registrado."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-purple-100 rounded-xl">
        <p className="text-xs font-bold text-purple-500 uppercase">
          Recado da professora:
        </p>
        <p className="text-purple-900 italic font-medium">
          "{evaluation.teacher_comment}"
        </p>
      </div>
    </div>
  );
};
