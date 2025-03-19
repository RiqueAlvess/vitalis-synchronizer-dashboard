
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

const ApiConfigForm = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração da API</CardTitle>
        <CardDescription>Configure as APIs de integração</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-6">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Esta tela foi substituída pela nova tela de configuração de APIs. 
            Por favor, utilize a página de "Configurações" para configurar as APIs de funcionários e absenteísmo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiConfigForm;
