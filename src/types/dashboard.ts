
export interface DashboardData {
  absenteeismRate: number;
  totalAbsenceDays: number; 
  employeesAbsent: number;
  costImpact: string;
  trend: 'up' | 'down' | 'stable' | 'neutral';
  monthlyTrend: {
    month: string;
    rate: number;
  }[];
  bySector: {
    sector: string;
    rate: number;
    count: number;
  }[];
  topCIDs?: {
    cid: string;
    description: string;
    count: number;
    percentage: number;
  }[];
}
