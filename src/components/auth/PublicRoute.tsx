
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [checkDone, setCheckDone] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log('Public route authentication check timeout triggered');
      setCheckDone(true);
    }, 3000);

    // If authentication check is complete, handle redirection
    if (!isLoading) {
      clearTimeout(timeoutId);
      setCheckDone(true);
      
      // If the user is authenticated and trying to access a public route like login,
      // redirect to the dashboard
      if (isAuthenticated) {
        console.log('Authenticated user trying to access public route:', location.pathname);
        const intended = location.state?.from || '/dashboard';
        navigate(intended, { replace: true });
      }
    }

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, isLoading, navigate, location]);

  // Show loading state only during initial check and not for too long
  if (isLoading && !checkDone) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600 mb-4" />
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Render children if not authenticated or if check has timed out
  return (!isAuthenticated || checkDone) ? <>{children}</> : null;
};

export default PublicRoute;
