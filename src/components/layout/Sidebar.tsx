
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileBarChart,
  Settings,
  LogOut,
  UserRound,
  RefreshCw,
  Activity,
  Building,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { VitalisLogo } from '@/components/ui-custom/VitalisLogo';

interface SidebarItemProps {
  icon: React.ReactNode;
  title: string;
  to: string;
  isPro?: boolean;
}

const SidebarItem = ({ icon, title, to, isPro = false }: SidebarItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Button
      variant="ghost"
      asChild
      className={cn(
        'w-full justify-start gap-2 mb-1',
        isActive ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground' : '',
        isPro ? 'opacity-60' : ''
      )}
    >
      <Link to={to} className='flex items-center'>
        {icon}
        <span>{title}</span>
        {isPro && (
          <span className="ml-auto px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase bg-muted text-muted-foreground rounded">
            PRO
          </span>
        )}
      </Link>
    </Button>
  );
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'US';
  const userEmail = user?.email || '';
  const userFullName = user?.fullName || "Usuário";

  return (
    <div className="h-screen flex flex-col border-r">
      <div className="p-4 flex items-center border-b">
        <Link to="/" className="flex items-center">
          <VitalisLogo height={32} />
        </Link>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <nav className="space-y-2">
          <SidebarItem
            icon={<LayoutDashboard className="h-4 w-4" />}
            title="Dashboard"
            to="/dashboard"
          />
          
          <SidebarItem
            icon={<RefreshCw className="h-4 w-4" />}
            title="Sincronização"
            to="/sync"
          />
          
          <SidebarItem
            icon={<Users className="h-4 w-4" />}
            title="Funcionários"
            to="/employees"
          />
          
          <SidebarItem
            icon={<FileBarChart className="h-4 w-4" />}
            title="Absenteísmo"
            to="/absenteeism"
            isPro={true}
          />
          
          <SidebarItem
            icon={<Activity className="h-4 w-4" />}
            title="Indicadores"
            to="/indicators"
            isPro={true}
          />
          
          <SidebarItem
            icon={<Building className="h-4 w-4" />}
            title="Empresas"
            to="/companies"
          />
          
          <SidebarItem
            icon={<AlertCircle className="h-4 w-4" />}
            title="Ajuda"
            to="/help"
          />
          
          <SidebarItem
            icon={<Settings className="h-4 w-4" />}
            title="Configurações"
            to="/settings"
          />
        </nav>
      </ScrollArea>
      
      <div className="p-4 border-t">
        <div className="flex items-center mb-4">
          <Avatar className="h-9 w-9 mr-2">
            <AvatarImage src="" alt={userFullName} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate">{userFullName}</span>
            <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/profile">
              <UserRound className="h-4 w-4 mr-1" />
              Perfil
            </Link>
          </Button>
          
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
