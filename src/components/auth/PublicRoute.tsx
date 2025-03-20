
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
    // First, check if the user is already authenticated
    if (isAuthenticated) {
      console.log('PublicRoute: User is authenticated, redirecting to dashboard');
      const intended = location.state?.from || '/dashboard';
      navigate(intended, { replace: true });
      return;
    }
    
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log('PublicRoute: Authentication check timeout triggered');
      setCheckDone(true);
    }, 3000);

    // When auth check completes and we know user isn't authenticated, render the page
    if (!isLoading && !isAuthenticated) {
      clearTimeout(timeoutId);
      setCheckDone(true);
    }

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, isLoading, navigate, location]);

  // Show loading state only during initial check and not indefinitely
  if ((isLoading || isAuthenticated) && !checkDone) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600 mb-4" />
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Render children only if not authenticated or check is done
  // This allows the page to show after timeout even if auth state is uncertain
  return (!isAuthenticated || checkDone) ? <>{children}</> : null;
};

export default PublicRoute;
