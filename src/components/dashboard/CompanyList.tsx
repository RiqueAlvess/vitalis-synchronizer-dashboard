
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-custom/Card';
import { Users } from 'lucide-react';

const CompanyList = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funcionários</CardTitle>
        <CardDescription>
          Acesse os funcionários sincronizados via API
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="py-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-muted-foreground">
            Acesse a lista completa na página de funcionários
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyList;
