import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./lib/supabaseClient";

// Importações de Componentes e Páginas
import { Login } from "./components/Login";
import { Dashboard } from "./pages/Dashboard";
import { LessonView } from "./pages/LessonView";
import { Navbar } from "./components/Navbar";
import { AdminEvaluations } from "./pages/AdminEvaluations";
import { StudentReport } from "./pages/StudentReport";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { StudentHistory } from "./pages/StudentHistory";
import { LinkStudent } from "./pages/LinkStudent";
import { SystemManagement } from "./pages/SystemManagement";

// --- COMPONENTE DE PROTEÇÃO DE ROTA ATUALIZADO ---
const RoleRoute = ({
  children,
  allowedRole,
  allowedRoles = []
}: {
  children: ReactNode;
  allowedRole?: "admin" | "student" | "professor";
  allowedRoles?: string[];
}) => {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(data?.role || null);
      }
      setLoading(false);
    }
    getRole();
  }, []);

  if (loading)
    return <div className="p-10 text-center font-bold text-blue-600">Verificando permissões...</div>;

  // Lógica de Verificação:
  // Se houver uma lista (allowedRoles), verifica se o cargo do usuário está nela.
  // Se houver apenas um cargo (allowedRole), verifica se é igual.
  const hasAccess = allowedRoles.length > 0 
    ? (userRole && allowedRoles.includes(userRole))
    : userRole === allowedRole;

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// --- APP PRINCIPAL ---
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* --- ROTAS DO ALUNO --- */}
        <Route path="/dashboard" element={
          <RoleRoute allowedRole="student">
            <><Navbar /><Dashboard /></>
          </RoleRoute>
        } />
        <Route path="/lesson/:id" element={
          <RoleRoute allowedRole="student">
            <><Navbar /><LessonView /></>
          </RoleRoute>
        } />
        <Route path="/meu-boletim" element={
          <RoleRoute allowedRole="student">
            <><Navbar /><StudentReport /></>
          </RoleRoute>
        } />

        {/* --- ROTAS DO PROFESSOR (Acessíveis por Admin e Professor) --- */}
        <Route path="/dashboard-professor" element={
          <RoleRoute allowedRoles={['admin', 'professor']}>
            <TeacherDashboard />
          </RoleRoute>
        } />
        <Route path="/admin/avaliar" element={
          <RoleRoute allowedRoles={['admin', 'professor']}>
            <AdminEvaluations />
          </RoleRoute>
        } />
        <Route path="/historico/:studentId" element={
          <RoleRoute allowedRoles={['admin', 'professor']}>
            <StudentHistory />
          </RoleRoute>
        } />

        {/* --- ROTAS EXCLUSIVAS DO ADMIN (Só você) --- */}
        <Route path="/gestao" element={
          <RoleRoute allowedRole="admin">
            <SystemManagement />
          </RoleRoute>
        } />
        <Route path="/vincular-aluno" element={
          <RoleRoute allowedRole="admin">
            <LinkStudent />
          </RoleRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
