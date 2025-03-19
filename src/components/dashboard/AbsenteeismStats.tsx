
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LockIcon, TrendingUp, TrendingDown, DollarSign, Clock, Users, Calendar } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

interface AbsenteeismStatsProps {
  data: {
    byDayOfWeek?: { name: string; value: number }[];
    byGender?: { name: string; value: number }[];
    byCid?: { name: string; value: number; cost: number }[];
  };
  isPremium: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

const AbsenteeismStats: React.FC<AbsenteeismStatsProps> = ({ data, isPremium }) => {
  const renderPremiumContent = (title: string, children: React.ReactNode) => {
    return (
      <div className="relative">
        {!isPremium && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <LockIcon className="h-10 w-10 text-gray-500 mb-2" />
            <h3 className="text-lg font-semibold text-gray-700">Recurso Premium</h3>
            <p className="text-sm text-gray-500 text-center mt-1 max-w-xs">
              Atualize para o plano premium para acessar análises avançadas de absenteísmo
            </p>
          </div>
        )}
        <Card className={cn("h-full", !isPremium && "opacity-70")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{title}</CardTitle>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {/* Absenteeism by Day of Week - Premium */}
      {renderPremiumContent(
        "Absenteísmo por Dia da Semana",
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.byDayOfWeek}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => [`${value} ocorrências`, 'Quantidade']}
              />
              <Bar dataKey="value" fill="#8884d8" name="Ocorrências" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Absenteeism by Gender - Premium */}
      {renderPremiumContent(
        "Absenteísmo por Gênero",
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.byGender}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {data.byGender?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value} dias`, 'Dias de afastamento']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Financial Impact by CID - Premium */}
      {renderPremiumContent(
        "Impacto Financeiro por CID",
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.byCid?.slice(0, 5)}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              layout="vertical"
            >
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Impacto Financeiro']}
              />
              <Bar dataKey="cost" fill="#82ca9d" name="Impacto Financeiro (R$)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Free General Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Estatísticas Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-800">Dica de Redução</AlertTitle>
            <AlertDescription className="text-amber-700">
              Programas de bem-estar e prevenção podem reduzir o absenteísmo em até 30%.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 border rounded-md p-3">
              <DollarSign className="h-10 w-10 text-blue-500 p-2 bg-blue-50 rounded-full" />
              <div>
                <p className="text-sm text-gray-500">Custo médio diário</p>
                <p className="font-medium">R$ 350,00</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 border rounded-md p-3">
              <Clock className="h-10 w-10 text-green-500 p-2 bg-green-50 rounded-full" />
              <div>
                <p className="text-sm text-gray-500">Duração média</p>
                <p className="font-medium">3.2 dias</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 border rounded-md p-3">
              <Users className="h-10 w-10 text-purple-500 p-2 bg-purple-50 rounded-full" />
              <div>
                <p className="text-sm text-gray-500">Reincidência</p>
                <p className="font-medium">24%</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 border rounded-md p-3">
              <Calendar className="h-10 w-10 text-orange-500 p-2 bg-orange-50 rounded-full" />
              <div>
                <p className="text-sm text-gray-500">Dias/ano</p>
                <p className="font-medium">8.4 dias</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AbsenteeismStats;
