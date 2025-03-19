
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

const CompanyApiConfig = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração da API de Empresas</CardTitle>
        <CardDescription>Esta funcionalidade foi removida</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-6">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            A funcionalidade de gerenciamento de empresas foi removida. 
            Por favor, utilize apenas as funcionalidades de gerenciamento de funcionários e absenteísmo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyApiConfig;
