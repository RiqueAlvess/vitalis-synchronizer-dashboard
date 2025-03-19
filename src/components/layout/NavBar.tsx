
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Menu, 
  X, 
  LogOut,
  RefreshCw
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/ui-custom/Logo';

const NavBar = () => {
  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { path: '/employees', label: 'Funcionários', icon: <Users className="h-5 w-5" /> },
    { path: '/sync', label: 'Sincronização', icon: <RefreshCw className="h-5 w-5" /> },
    { path: '/settings', label: 'Configurações', icon: <Settings className="h-5 w-5" /> },
  ];

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  useEffect(() => {
    closeMenu();
  }, [pathname]);

  if (!isAuthenticated && pathname !== '/') {
    return null; // Don't show navbar on auth pages
  }

  if (pathname === '/' && !isAuthenticated) {
    return (
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled 
            ? "py-2 bg-white/80 backdrop-blur-md shadow-sm" 
            : "py-5 bg-transparent"
        )}
      >
        <div className="container flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-2"
          >
            <Logo variant="icon" size="lg" />
            <span className="font-semibold text-xl">Vitalis</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <nav className="flex items-center gap-6">
              <a href="#features" className="text-sm font-medium hover:text-vitalis-600 transition-colors">
                Recursos
              </a>
              <a href="#how-it-works" className="text-sm font-medium hover:text-vitalis-600 transition-colors">
                Como funciona
              </a>
              <a href="#pricing" className="text-sm font-medium hover:text-vitalis-600 transition-colors">
                Planos
              </a>
            </nav>
            
            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">
                  Registrar
                </Button>
              </Link>
            </div>
          </div>
          
          {isMobile && (
            <button 
              onClick={toggleMenu}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
        
        {isMobile && isMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white shadow-lg animate-slide-down">
            <div className="container py-4 flex flex-col gap-4">
              <nav className="flex flex-col gap-3">
                <a href="#features" className="py-2 px-4 hover:bg-gray-100 rounded-md transition-colors">
                  Recursos
                </a>
                <a href="#how-it-works" className="py-2 px-4 hover:bg-gray-100 rounded-md transition-colors">
                  Como funciona
                </a>
                <a href="#pricing" className="py-2 px-4 hover:bg-gray-100 rounded-md transition-colors">
                  Planos
                </a>
              </nav>
              
              <div className="flex flex-col gap-2 mt-2">
                <Link to="/login" className="w-full">
                  <Button variant="ghost" className="w-full justify-start">
                    Entrar
                  </Button>
                </Link>
                <Link to="/register" className="w-full">
                  <Button className="w-full justify-start">
                    Registrar
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    );
  }

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-40 transition-all duration-300 py-3",
        scrolled ? "bg-white/80 backdrop-blur-md shadow-sm" : "bg-white"
      )}
    >
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2">
            <Logo variant="icon" size="lg" />
            <span className="font-semibold text-lg">Vitalis</span>
          </Link>
          
          {!isMobile && (
            <nav className="flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 py-1 px-3 rounded-md text-sm font-medium transition-colors",
                    pathname === item.path
                      ? "bg-vitalis-50 text-vitalis-700"
                      : "text-gray-600 hover:text-vitalis-600 hover:bg-gray-50"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        )}
        
        {isMobile && (
          <button 
            onClick={toggleMenu}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
      </div>
      
      {isMobile && isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white shadow-lg animate-slide-down">
          <div className="container py-4 flex flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 py-3 px-4 rounded-md transition-colors",
                  pathname === item.path
                    ? "bg-vitalis-50 text-vitalis-700"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            
            <Button
              variant="ghost"
              className="mt-2 w-full justify-start"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default NavBar;
