import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './pages/Dashboard';
import { LessonView } from './pages/LessonView';
import { Navbar } from './components/Navbar';

function App() {
  return (
    <BrowserRouter>
      {/* A Navbar fica fora de Routes se você quiser que ela apareça sempre */}
      <Routes>
        <Route path="/" element={<Login />} />
        {/* Usamos um padrão aqui: páginas logadas podem ter a Navbar */}
        <Route path="/dashboard" element={<><Navbar /><Dashboard /></>} />
        <Route path="/lesson/:id" element={<><Navbar /><LessonView /></>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;