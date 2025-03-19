
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-custom/Card';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

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
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Users className="h-10 w-10 mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground mb-4">
            Acesse a lista completa na página de funcionários
          </p>
          <Link to="/employees">
            <Button variant="outline" size="sm">
              Ver funcionários
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyList;
