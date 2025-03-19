
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Se o usuário está autenticado e tenta acessar uma rota pública como login,
    // redireciona para o dashboard
    if (!isLoading && isAuthenticated) {
      console.log('Usuário autenticado tentando acessar rota pública:', location.pathname);
      const intended = location.state?.from || '/dashboard';
      navigate(intended, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600 mb-4" />
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Render children if not authenticated
  return !isAuthenticated ? <>{children}</> : null;
};

export default PublicRoute;
