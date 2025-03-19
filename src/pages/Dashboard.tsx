
import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const Dashboard = () => {
  const { user, isAuthenticated, saveSettings, getSettings } = useAuth();
  const [userSettings, setUserSettings] = useState<any>({});

  useEffect(() => {
    const loadSettings = async () => {
      if (isAuthenticated) {
        try {
          const settings = await getSettings();
          console.log("Configurações carregadas:", settings);
          setUserSettings(settings);
        } catch (error) {
          console.error("Erro ao carregar configurações:", error);
        }
      }
    };

    loadSettings();
  }, [isAuthenticated, getSettings]);

  const handleSaveSettings = async () => {
    if (!user) return;
    
    // Exemplo de configurações para salvar
    const settings = { 
      theme: userSettings?.theme || 'light', 
      notifications: userSettings?.notifications !== undefined ? userSettings.notifications : true,
      lastUpdated: new Date().toISOString()
    };
    
    const success = await saveSettings(settings);
    
    if (success) {
      toast({
        title: 'Configurações salvas',
        description: 'Suas preferências foram atualizadas com sucesso!',
      });
      setUserSettings(settings);
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
      <DashboardOverview />
      
      {/* Exemplo de uso das configurações */}
      {isAuthenticated && (
        <div className="mt-8 p-4 bg-card rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Suas Preferências</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Tema: {userSettings?.theme === 'dark' ? 'Escuro' : 'Claro'}</span>
              <Button variant="outline" onClick={toggleTheme}>
                Alternar Tema
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Notificações: {userSettings?.notifications ? 'Ativadas' : 'Desativadas'}</span>
              <Button variant="outline" onClick={toggleNotifications}>
                {userSettings?.notifications ? 'Desativar' : 'Ativar'}
              </Button>
            </div>
            
            {userSettings?.lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Última atualização: {new Date(userSettings.lastUpdated).toLocaleString()}
              </p>
            )}
            
            <Button className="w-full" onClick={handleSaveSettings}>
              Salvar Configurações
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
