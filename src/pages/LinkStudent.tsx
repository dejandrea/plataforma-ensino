import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Link } from 'react-router-dom';

export const LinkStudent = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    // Busca todos os perfis que são alunos
    const { data: studentsData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'student')
      .order('full_name');

    // Busca todos os perfis que são professores ou admins
    const { data: teachersData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['professor', 'admin'])
      .order('full_name');

    setStudents(studentsData || []);
    setTeachers(teachersData || []);
  }

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedTeacher) {
      setMessage({ text: 'Selecione ambos para vincular.', type: 'error' });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('teacher_student_relations')
      .insert({ 
        teacher_id: selectedTeacher, 
        student_id: selectedStudent 
      });

    if (error) {
      if (error.code === '23505') {
        setMessage({ text: 'Este vínculo já existe!', type: 'error' });
      } else {
        setMessage({ text: 'Erro ao vincular: ' + error.message, type: 'error' });
      }
    } else {
      setMessage({ text: 'Vínculo criado com sucesso! 🎉', type: 'success' });
      setSelectedStudent('');
      setSelectedTeacher('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-10">
          <Link to="/gestao" className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-bold">
            ← Voltar para Gestão
          </Link>
          <h1 className="text-4xl font-black italic mt-4">Vincular Aluno & Professor</h1>
          <p className="text-gray-400 mt-2">Defina quem será o mentor responsável por cada inventor.</p>
        </header>

        <form onSubmit={handleLink} className="bg-gray-800 p-8 rounded-3xl border border-gray-700 shadow-2xl space-y-6">
          {/* Seleção de Aluno */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Selecionar Aluno</label>
            <select 
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full mt-2 p-4 bg-gray-900 border border-gray-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="">Escolha um aluno...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-center py-2 text-blue-500/30">
            <span className="text-2xl">⬇️</span>
          </div>

          {/* Seleção de Professor */}
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Professor(a) Responsável</label>
            <select 
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full mt-2 p-4 bg-gray-900 border border-gray-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            >
              <option value="">Escolha o(a) professor(a)...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>

          {message.text && (
            <div className={`p-4 rounded-2xl text-sm font-bold text-center ${
              message.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-800' : 'bg-red-900/20 text-red-400 border border-red-800'
            }`}>
              {message.text}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 active:scale-95"
          >
            {loading ? 'Processando...' : 'Confirmar Vínculo'}
          </button>
        </form>
      </div>
    </div>
  );
};