import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, BarChart2, Settings, Users, CheckCircle } from 'lucide-react';
import GlassPanel from '@/components/ui-custom/GlassPanel';
import Logo from '@/components/ui-custom/Logo';

const Index = () => {
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        
        <div className="container px-4 md:px-6 mx-auto relative z-10">
          <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto animate-fade-in">
            <div className="inline-flex flex-col items-center">
              <Logo variant="full" size="lg" className="mb-6" />
              <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-vitalis-100 text-vitalis-800">
                Plataforma de Gestão de Absenteísmo
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Transforme dados de absenteísmo em
              <span className="text-gradient"> insights estratégicos</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa para monitorar, analisar e reduzir o impacto do absenteísmo em sua empresa.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to="/register">
                <Button size="lg" className="rounded-lg px-8">
                  Comece Agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              
              <Link to="/login">
                <Button variant="outline" size="lg" className="rounded-lg px-8">
                  Acessar Plataforma
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="mt-16 lg:mt-20 max-w-5xl mx-auto animate-fade-in animate-delay-300">
            <GlassPanel className="p-6 md:p-8 shadow-glass-strong">
              <div className="relative aspect-video overflow-hidden rounded-lg">
                <img 
                  src="https://placehold.co/1200x675/f5faff/e6e6e6?text=Dashboard+Preview" 
                  alt="Dashboard do Vitalis"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
              </div>
            </GlassPanel>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Recursos Poderosos para Gestão de Absenteísmo</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo o que você precisa para entender e reduzir o impacto do absenteísmo em sua empresa.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-subtle hover:shadow-elevated transition-all duration-300 border">
              <div className="h-12 w-12 bg-vitalis-100 rounded-lg flex items-center justify-center text-vitalis-600 mb-4">
                <BarChart2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Dashboard Intuitivo</h3>
              <p className="text-muted-foreground">
                Visualize as principais métricas de absenteísmo em um dashboard intuitivo e personalizável.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-subtle hover:shadow-elevated transition-all duration-300 border">
              <div className="h-12 w-12 bg-vitalis-100 rounded-lg flex items-center justify-center text-vitalis-600 mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Gestão de Funcionários</h3>
              <p className="text-muted-foreground">
                Acompanhe o histórico de afastamentos de cada funcionário e identifique padrões.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-subtle hover:shadow-elevated transition-all duration-300 border">
              <div className="h-12 w-12 bg-vitalis-100 rounded-lg flex items-center justify-center text-vitalis-600 mb-4">
                <Settings className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Integração com API SOC</h3>
              <p className="text-muted-foreground">
                Importe automaticamente os dados de absenteísmo do seu sistema SOC para análise detalhada.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Como o Vitalis Funciona</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Um processo simples para transformar seus dados em insights acionáveis.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="h-16 w-16 bg-vitalis-500 rounded-full flex items-center justify-center text-white mb-6">
                  <span className="text-xl font-semibold">1</span>
                </div>
                {/* Line connector */}
                <div className="hidden lg:block absolute top-1/2 left-full h-0.5 w-full -translate-y-1/2 bg-vitalis-200" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Integre</h3>
              <p className="text-muted-foreground">
                Configure a integração com a API SOC em minutos.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="h-16 w-16 bg-vitalis-500 rounded-full flex items-center justify-center text-white mb-6">
                  <span className="text-xl font-semibold">2</span>
                </div>
                {/* Line connector */}
                <div className="hidden lg:block absolute top-1/2 left-full h-0.5 w-full -translate-y-1/2 bg-vitalis-200" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Sincronize</h3>
              <p className="text-muted-foreground">
                Sincronize empresas, funcionários e registros de absenteísmo.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 bg-vitalis-500 rounded-full flex items-center justify-center text-white mb-6">
                <span className="text-xl font-semibold">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Analise</h3>
              <p className="text-muted-foreground">
                Obtenha insights sobre causas, impactos e tendências do absenteísmo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos Simples e Transparentes</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para as necessidades da sua empresa.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-subtle hover:shadow-elevated transition-all duration-300 border">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Gratuito</h3>
                <p className="text-muted-foreground">Para empresas que estão começando.</p>
              </div>
              
              <div className="mb-6">
                <div className="text-4xl font-bold">R$ 0</div>
                <p className="text-muted-foreground">Para sempre</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Limite de 3 meses de histórico</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Dashboard básico</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Evolução mensal</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Top CIDs e setores afetados</span>
                </li>
              </ul>
              
              <Link to="/register">
                <Button variant="outline" className="w-full rounded-lg">
                  Começar grátis
                </Button>
              </Link>
            </div>
            
            <div className="bg-vitalis-50 rounded-xl p-8 shadow-subtle hover:shadow-elevated transition-all duration-300 border border-vitalis-200 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-vitalis-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                Recomendado
              </div>
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Premium</h3>
                <p className="text-muted-foreground">Para empresas que precisam de recursos avançados.</p>
              </div>
              
              <div className="mb-6">
                <div className="text-4xl font-bold">R$ 299</div>
                <p className="text-muted-foreground">por mês</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Histórico completo sem limitações</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Todas as funcionalidades do plano gratuito</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Análise por gênero, dia da semana, prejuízo por CID</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Exportação de dados em Excel e PDF</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Alertas personalizados</span>
                </li>
              </ul>
              
              <Link to="/register">
                <Button className="w-full rounded-lg">
                  Experimente 14 dias grátis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-gray-50 border-t border-gray-200">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Logo variant="icon" size="md" />
              <span className="font-semibold text-lg">Vitalis</span>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Recursos
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Como funciona
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Planos
              </a>
              {isAuthenticated ? (
                <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              ) : (
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Entrar
                </Link>
              )}
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-200 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Vitalis. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
