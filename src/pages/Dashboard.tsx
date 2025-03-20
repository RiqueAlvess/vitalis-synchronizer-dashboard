
import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorBoundary from '@/components/ui-custom/ErrorBoundary';

const Dashboard = () => {
  const { user, isAuthenticated, getSettings } = useAuth();
  const [userSettings, setUserSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (isAuthenticated && user?.id) {
        try {
          setIsLoading(true);
          const settings = await getSettings();
          console.log("Configurações carregadas:", settings);
          setUserSettings(settings);
        } catch (error) {
          console.error("Erro ao carregar configurações:", error);
          // Show empty settings even on error
          setUserSettings({});
        } finally {
          setIsLoading(false);
        }
      } else {
        // Don't get stuck in loading if not authenticated
        setIsLoading(false);
      }
    };

    loadSettings();
    
    // Set a guaranteed timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log("Force ending loading state after timeout");
        setIsLoading(false);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [isAuthenticated, getSettings, user]);

  return (
    <DashboardLayout 
      title="Dashboard" 
      subtitle="Visão geral do absenteísmo na sua empresa"
    >
      <ErrorBoundary>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
            <Skeleton className="h-80 md:col-span-2" />
            <Skeleton className="h-80 md:col-span-2" />
          </div>
        ) : (
          <DashboardOverview />
        )}
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default Dashboard;
