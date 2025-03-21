
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeOffIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

const LoginForm = () => {
  const { login, isLoading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log("LoginForm: User is authenticated, redirecting to dashboard");
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Reset submission state if global loading state changes
  useEffect(() => {
    if (!isLoading && isSubmitting) {
      setIsSubmitting(false);
    }
  }, [isLoading, isSubmitting]);
  
  const toggleShowPassword = () => setShowPassword(!showPassword);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'O e-mail é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }
    
    if (!password) {
      newErrors.password = 'A senha é obrigatória';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    // Prevent multiple attempts in quick succession
    const now = Date.now();
    if (now - lastAttemptTime < 2000) {
      toast({
        title: "Aguarde um momento",
        description: "Tente novamente em alguns segundos",
        variant: "default"
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      setLoginAttempts(prev => prev + 1);
      setLastAttemptTime(now);
      
      console.log(`Tentando fazer login com email: ${email}`);
      await login(email, password);
      // Login successful, navigation happens in auth context
    } catch (error) {
      console.error("Erro capturado no formulário de login:", error);
      setIsSubmitting(false); // Make sure to reset on error
      // Error is already handled in AuthContext
    }
  };

  const handleDemoLogin = async () => {
    // Prevent multiple attempts in quick succession
    const now = Date.now();
    if (now - lastAttemptTime < 2000) {
      toast({
        title: "Aguarde um momento",
        description: "Tente novamente em alguns segundos",
        variant: "default"
      });
      return;
    }
    
    setEmail('demo@example.com');
    setPassword('demo123');
    
    try {
      setIsSubmitting(true);
      setLoginAttempts(prev => prev + 1);
      setLastAttemptTime(now);
      
      console.log("Tentando fazer login com conta demo");
      await login('demo@example.com', 'demo123');
      // Login successful, navigation happens in auth context
    } catch (error) {
      console.error("Erro ao fazer login com conta demo:", error);
      setIsSubmitting(false); // Make sure to reset on error
    }
  };

  // Add delay to prevent too many attempts in quick succession
  const isButtonDisabled = isSubmitting || isLoading || loginAttempts > 5;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(errors.email && "border-red-300 focus-visible:ring-red-200")}
            autoComplete="email"
            disabled={isSubmitting || isLoading}
          />
          {errors.email && (
            <p className="text-sm text-red-500 mt-1">{errors.email}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link 
              to="/forgot-password" 
              className="text-xs text-vitalis-600 hover:text-vitalis-800 transition-colors"
            >
              Esqueceu a senha?
            </Link>
          </div>
          
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(errors.password && "border-red-300 focus-visible:ring-red-200")}
              autoComplete="current-password"
              disabled={isSubmitting || isLoading}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={toggleShowPassword}
              disabled={isSubmitting || isLoading}
            >
              {showPassword ? (
                <EyeOffIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          
          {errors.password && (
            <p className="text-sm text-red-500 mt-1">{errors.password}</p>
          )}
        </div>
      </div>
      
      <Button 
        type="submit" 
        className="w-full"
        disabled={isButtonDisabled}
      >
        {(isSubmitting || isLoading) ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : "Entrar"}
      </Button>
      
      {/* Warning about login attempt limit */}
      {loginAttempts > 5 && (
        <p className="text-sm text-amber-600 text-center">
          Muitas tentativas de login. Por favor, aguarde um momento antes de tentar novamente.
        </p>
      )}
      
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <span className="relative px-3 text-xs font-medium text-muted-foreground bg-white">
          Ou
        </span>
      </div>
      
      <Button 
        type="button" 
        variant="outline" 
        className="w-full"
        onClick={handleDemoLogin}
        disabled={isButtonDisabled}
      >
        {(isSubmitting || isLoading) ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : "Login com conta demo"}
      </Button>
      
      <p className="text-center text-sm text-muted-foreground">
        Não tem uma conta?{' '}
        <Link 
          to="/register" 
          className="text-vitalis-600 hover:text-vitalis-800 font-medium transition-colors"
        >
          Registrar
        </Link>
      </p>
    </form>
  );
};

export default LoginForm;
