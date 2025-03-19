
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Save, Moon, Sun, Bell, BellOff } from 'lucide-react';

const UserProfile = () => {
  const { user, isAuthenticated, updateProfile, saveSettings, getSettings } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userSettings, setUserSettings] = useState<any>({});
  const [profileData, setProfileData] = useState({
    fullName: '',
    companyName: '',
    jobTitle: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      if (isAuthenticated && user) {
        try {
          setIsLoading(true);
          
          // Load user profile data
          setProfileData({
            fullName: user.fullName || '',
            companyName: user.companyName || '',
            jobTitle: user.jobTitle || ''
          });
          
          // Load user settings
          const settings = await getSettings();
          setUserSettings(settings || {});
        } catch (error) {
          console.error("Erro ao carregar dados do perfil:", error);
          toast({
            variant: 'destructive',
            title: 'Erro ao carregar',
            description: 'Não foi possível carregar suas informações de perfil.',
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    loadData();
    
    // Safety timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [isAuthenticated, user, getSettings, toast]);

  const handleProfileUpdate = async () => {
    if (!user) return;
    
    try {
      setIsSaving(true);
      
      // Update user profile
      await updateProfile({
        id: user.id,
        fullName: profileData.fullName,
        companyName: profileData.companyName,
        jobTitle: profileData.jobTitle,
        isPremium: user.isPremium
      });
      
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações de perfil foram atualizadas com sucesso!',
      });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar seu perfil.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingsSave = async () => {
    if (!user) return;
    
    try {
      setIsSaving(true);
      
      // Update user settings
      const success = await saveSettings({
        ...userSettings,
        lastUpdated: new Date().toISOString()
      });
      
      if (success) {
        toast({
          title: 'Preferências salvas',
          description: 'Suas preferências foram atualizadas com sucesso!',
        });
      }
    } catch (error) {
      console.error("Erro ao salvar preferências:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar suas preferências.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTheme = () => {
    setUserSettings({
      ...userSettings,
      theme: userSettings?.theme === 'dark' ? 'light' : 'dark'
    });
  };

  const toggleNotifications = () => {
    setUserSettings({
      ...userSettings,
      notifications: !userSettings?.notifications
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600" />
        <span className="ml-2">Carregando perfil...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
                  placeholder="Seu nome completo"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="companyName">Empresa</Label>
                <Input
                  id="companyName"
                  value={profileData.companyName}
                  onChange={(e) => setProfileData({...profileData, companyName: e.target.value})}
                  placeholder="Nome da sua empresa"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Cargo</Label>
                <Input
                  id="jobTitle"
                  value={profileData.jobTitle || ''}
                  onChange={(e) => setProfileData({...profileData, jobTitle: e.target.value})}
                  placeholder="Seu cargo na empresa"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleProfileUpdate} 
              className="w-full"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Atualizar Perfil
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Preferências</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Tema</Label>
                <div className="text-sm text-muted-foreground">
                  {userSettings?.theme === 'dark' ? 'Escuro' : 'Claro'}
                </div>
              </div>
              <Button variant="outline" onClick={toggleTheme} size="sm">
                {userSettings?.theme === 'dark' ? (
                  <Sun className="h-4 w-4 mr-2" />
                ) : (
                  <Moon className="h-4 w-4 mr-2" />
                )}
                Alternar Tema
              </Button>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificações</Label>
                <div className="text-sm text-muted-foreground">
                  {userSettings?.notifications ? 'Ativadas' : 'Desativadas'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {userSettings?.notifications ? (
                  <Bell className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch
                  checked={!!userSettings?.notifications}
                  onCheckedChange={toggleNotifications}
                />
              </div>
            </div>
            
            {userSettings?.lastUpdated && (
              <div className="text-xs text-muted-foreground mt-4">
                Última atualização: {new Date(userSettings.lastUpdated).toLocaleString()}
              </div>
            )}
            
            <Button 
              className="w-full" 
              onClick={handleSettingsSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Preferências
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserProfile;
