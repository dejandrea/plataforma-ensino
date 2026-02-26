import { useNavigate } from 'react-router-dom';

interface LessonProps {
  id: string; // Adicionamos o ID aqui
  title: string;
  type: 'video' | 'pdf' | 'meet';
  isCompleted: boolean;
}

export const LessonCard = ({ id, title, type, isCompleted }: LessonProps) => {
  const navigate = useNavigate(); // O "motor" de navegação

  return (
    <div 
      onClick={() => navigate(`/lesson/${id}`)} // Navega para a rota dinâmica
      className={`flex items-center p-4 mb-3 rounded-xl cursor-pointer transition-all
        ${isCompleted ? 'bg-green-50 border-l-4 border-green-500' : 'bg-white border-l-4 border-blue-500 shadow-sm'}
        hover:shadow-md hover:scale-[1.01] active:scale-95`} // Efeito visual de clique
    >
      <span className="text-2xl mr-4">
        {type === 'video' ? '🎥' : type === 'pdf' ? '📄' : '👥'}
      </span>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <p className="text-sm text-gray-500">
          {isCompleted ? '✅ Concluído' : '🚀 Clique para começar'}
        </p>
      </div>
      <span className="text-gray-400">➡️</span>
    </div>
  );
};