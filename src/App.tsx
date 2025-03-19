
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './context/AuthContext';
import PageTransition from './components/layout/PageTransition';
import NavBar from './components/layout/NavBar';

// Pages
import Index from './pages/Index';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Settings from './pages/Settings';
import Sync from './pages/Sync';
import NotFound from './pages/NotFound';

import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <NavBar />
        <PageTransition>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sync" element={<Sync />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;
