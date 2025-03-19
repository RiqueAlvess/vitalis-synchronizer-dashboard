
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check } from 'lucide-react';

interface PremiumFeaturesProps {
  isPremium: boolean;
  onUpgrade: () => void;
}

const PremiumFeatures: React.FC<PremiumFeaturesProps> = ({ isPremium, onUpgrade }) => {
  if (isPremium) {
    return null; // Don't show this card to premium users
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg text-amber-800 flex items-center">
            <Crown className="h-5 w-5 mr-2 text-amber-500" />
            Recursos Premium
          </CardTitle>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            Disponível
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-amber-700 mb-4">
          Desbloqueie recursos avançados para análise completa do absenteísmo na sua empresa.
        </p>
        
        <div className="space-y-2">
          <div className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm">Análises detalhadas por CID, gênero e dia da semana</p>
          </div>
          
          <div className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm">Exportação de relatórios em Excel e PDF</p>
          </div>
          
          <div className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm">Alertas e notificações de tendências de absenteísmo</p>
          </div>
          
          <div className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm">Comparação com benchmarks do setor</p>
          </div>
          
          <div className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm">Previsões e análises de tendências futuras</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onUpgrade} 
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"
        >
          <Crown className="h-4 w-4 mr-2" />
          Atualizar para Premium
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PremiumFeatures;
