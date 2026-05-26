import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./lib/supabaseClient";
import { Login } from "./components/Login";
import { Dashboard } from "./pages/Dashboard";
import { LessonView } from "./pages/LessonView";
import { Navbar } from "./components/Navbar";
import { StaffNavbar } from "./components/StaffNavbar";
import { AdminEvaluations } from "./pages/AdminEvaluations";
import { StudentReport } from "./pages/StudentReport";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { StudentHistory } from "./pages/StudentHistory";
import { LinkStudent } from "./pages/LinkStudent";
import { SystemManagement } from "./pages/SystemManagement";
import { ResetPassword } from "./pages/ResetPassword";
import { StudentLessons } from "./pages/StudentLessons";
import { TeacherScheduling } from "./pages/TeacherScheduling";
import { ensureUserProfile } from "./lib/ensureUserProfile";

const RoleRoute = ({
  children,
  allowedRole,
  allowedRoles = [],
}: {
  children: ReactNode;
  allowedRole?: "admin" | "student" | "professor";
  allowedRoles?: string[];
}) => {
  const [loading, setLoading] = useState(true);
  const [accessProfile, setAccessProfile] = useState<{
    role: string;
    is_active: boolean;
  } | null>(null);

  useEffect(() => {
    async function getRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const data = await ensureUserProfile(user.id, user.email);

        setAccessProfile(data || null);
      }

      setLoading(false);
    }

    getRole();
  }, []);

  if (loading) {
    return (
      <div className="app-bg">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-10 text-center font-bold text-white/70 ring-1 ring-white/10">
            Verificando permissoes...
          </div>
        </div>
      </div>
    );
  }

  const hasAccess =
    Boolean(accessProfile?.is_active) &&
    (allowedRoles.length > 0
      ? Boolean(accessProfile?.role && allowedRoles.includes(accessProfile.role))
      : accessProfile?.role === allowedRole);

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />

        <Route
          path="/dashboard"
          element={
            <RoleRoute allowedRole="student">
              <>
                <Navbar />
                <Dashboard />
              </>
            </RoleRoute>
          }
        />
        <Route
          path="/lesson/:id"
          element={
            <RoleRoute allowedRole="student">
              <>
                <Navbar />
                <LessonView />
              </>
            </RoleRoute>
          }
        />
        <Route
          path="/minhas-aulas"
          element={
            <RoleRoute allowedRole="student">
              <>
                <Navbar />
                <StudentLessons />
              </>
            </RoleRoute>
          }
        />
        <Route
          path="/meu-boletim"
          element={
            <RoleRoute allowedRole="student">
              <>
                <Navbar />
                <StudentReport />
              </>
            </RoleRoute>
          }
        />

        <Route
          path="/dashboard-professor"
          element={
            <RoleRoute allowedRoles={["admin", "professor"]}>
              <>
                <StaffNavbar />
                <TeacherDashboard />
              </>
            </RoleRoute>
          }
        />
        <Route
          path="/agendamentos"
          element={
            <RoleRoute allowedRoles={["admin", "professor"]}>
              <>
                <StaffNavbar />
                <TeacherScheduling />
              </>
            </RoleRoute>
          }
        />
        <Route
          path="/admin/avaliar"
          element={
            <RoleRoute allowedRoles={["admin", "professor"]}>
              <>
                <StaffNavbar />
                <AdminEvaluations />
              </>
            </RoleRoute>
          }
        />
        <Route
          path="/historico/:studentId"
          element={
            <RoleRoute allowedRoles={["admin", "professor"]}>
              <>
                <StaffNavbar />
                <StudentHistory />
              </>
            </RoleRoute>
          }
        />

        <Route
          path="/gestao"
          element={
            <RoleRoute allowedRole="admin">
              <>
                <StaffNavbar />
                <SystemManagement />
              </>
            </RoleRoute>
          }
        />
        <Route
          path="/vincular-aluno"
          element={
            <RoleRoute allowedRole="admin">
              <>
                <StaffNavbar />
                <LinkStudent />
              </>
            </RoleRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
