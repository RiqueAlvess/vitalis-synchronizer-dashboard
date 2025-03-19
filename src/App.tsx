
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './context/AuthContext';
import PageTransition from './components/layout/PageTransition';

// Pages
import Index from './pages/Index';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Employees from './pages/Employees';
import ApiConfig from './pages/ApiConfig';
import Settings from './pages/Settings';
import Sync from './pages/Sync';
import NotFound from './pages/NotFound';

import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <PageTransition>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/api-config" element={<ApiConfig />} />
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
