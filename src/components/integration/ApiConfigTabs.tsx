
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, CalendarDays } from 'lucide-react';
import CompanyApiConfig from './CompanyApiConfig';
import EmployeeApiConfig from './EmployeeApiConfig';
import AbsenteeismApiConfig from './AbsenteeismApiConfig';

const ApiConfigTabs = () => {
  const [activeTab, setActiveTab] = useState("company");

  return (
    <Tabs defaultValue="company" value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid grid-cols-3 mb-8">
        <TabsTrigger value="company" className="flex items-center gap-2">
          <Building className="h-4 w-4" />
          API de Empresas
        </TabsTrigger>
        <TabsTrigger value="employee" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          API de Funcionários
        </TabsTrigger>
        <TabsTrigger value="absenteeism" className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          API de Absenteísmo
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="company" className="animate-fade-in">
        <CompanyApiConfig />
      </TabsContent>
      
      <TabsContent value="employee" className="animate-fade-in">
        <EmployeeApiConfig />
      </TabsContent>
      
      <TabsContent value="absenteeism" className="animate-fade-in">
        <AbsenteeismApiConfig />
      </TabsContent>
    </Tabs>
  );
};

export default ApiConfigTabs;
