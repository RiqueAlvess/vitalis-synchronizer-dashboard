
import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const { user, isAuthenticated, saveSettings, getSettings } = useAuth();
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

    // Set a timeout to ensure we don't get stuck in loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    loadSettings();
    
    return () => clearTimeout(timeout);
  }, [isAuthenticated, getSettings, user]);

  const handleSaveSettings = async () => {
    if (!user) return;
    
    // Exemplo de configurações para salvar
    const settings = { 
      theme: userSettings?.theme || 'light', 
      notifications: userSettings?.notifications !== undefined ? userSettings.notifications : true,
      lastUpdated: new Date().toISOString()
    };
    
    try {
      const success = await saveSettings(settings);
      
      if (success) {
        toast({
          title: 'Configurações salvas',
          description: 'Suas preferências foram atualizadas com sucesso!',
        });
        setUserSettings(settings);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar suas preferências.',
      });
    }
  };

  const toggleTheme = () => {
    const newTheme = userSettings?.theme === 'dark' ? 'light' : 'dark';
    setUserSettings({
      ...userSettings,
      theme: newTheme
    });
  };

  const toggleNotifications = () => {
    setUserSettings({
      ...userSettings,
      notifications: !userSettings?.notifications
    });
  };

  return (
    <DashboardLayout 
      title="Dashboard" 
      subtitle="Visão geral do absenteísmo na sua empresa"
    >
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
      
      {/* Moved to UserProfile component instead */}
    </DashboardLayout>
  );
};

export default Dashboard;
