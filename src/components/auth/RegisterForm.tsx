
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { EyeIcon, EyeOffIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const RegisterForm = () => {
  const { register, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    companyName?: string;
  }>({});

  const toggleShowPassword = () => setShowPassword(!showPassword);

  const validate = () => {
    const newErrors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      companyName?: string;
    } = {};
    
    if (!email) {
      newErrors.email = 'O e-mail é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }
    
    if (!password) {
      newErrors.password = 'A senha é obrigatória';
    } else if (password.length < 6) {
      newErrors.password = 'A senha deve ter pelo menos 6 caracteres';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirme sua senha';
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }
    
    if (!companyName) {
      newErrors.companyName = 'O nome da empresa é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    try {
      await register(email, password, companyName);
    } catch (error) {
      // Error is handled in the AuthContext
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
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
          />
          {errors.email && (
            <p className="text-sm text-red-500 mt-1">{errors.email}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="companyName">Nome da Empresa</Label>
          <Input
            id="companyName"
            type="text"
            placeholder="Sua Empresa Ltda."
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={cn(errors.companyName && "border-red-300 focus-visible:ring-red-200")}
          />
          {errors.companyName && (
            <p className="text-sm text-red-500 mt-1">{errors.companyName}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(errors.password && "border-red-300 focus-visible:ring-red-200")}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={toggleShowPassword}
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
        
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar Senha</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={cn(errors.confirmPassword && "border-red-300 focus-visible:ring-red-200")}
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
          )}
        </div>
      </div>
      
      <Button 
        type="submit" 
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando...
          </>
        ) : "Criar Conta"}
      </Button>
      
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Ao criar uma conta, você concorda com nossos{' '}
        <a href="#" className="text-vitalis-600 hover:text-vitalis-800">
          Termos de Serviço
        </a>{' '}
        e{' '}
        <a href="#" className="text-vitalis-600 hover:text-vitalis-800">
          Política de Privacidade
        </a>
      </p>
      
      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link 
          to="/login" 
          className="text-vitalis-600 hover:text-vitalis-800 font-medium transition-colors"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
};

export default RegisterForm;
