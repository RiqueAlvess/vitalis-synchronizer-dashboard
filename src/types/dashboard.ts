
export interface DashboardData {
  absenteeismRate: number;
  totalAbsenceDays: number;
  employeesAbsent: number;
  costImpact: string;
  trend: 'up' | 'down' | 'stable';
  monthlyTrend: {
    month: string;
    count: number;
    hours: number;
    value: number;
  }[];
  bySector: {
    name: string;
    value: number;
  }[];
}

export interface MonthlyTrendData {
  month: string;
  count: number;
  hours: number;
  value: number;
}

export interface SectorData {
  name: string;
  value: number;
}
