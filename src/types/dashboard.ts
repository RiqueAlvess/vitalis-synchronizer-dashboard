
export interface DashboardData {
  absenteeismRate: number;
  totalAbsenceDays: number;
  employeesAbsent: number;
  costImpact: string;
  trend: 'up' | 'down' | 'stable' | 'neutral';
  monthlyTrend: MonthlyTrendData[];
  bySector: SectorData[];
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

// Define types for mock data
export interface MockEmployeeData {
  id: number;
  name: string;
  full_name: string;
  position: string;
  position_name: string;
  sector: string;
  sector_name: string;
  status: string;
  absentDays: number;
}

// Add API configuration interfaces with savedLocally property
export interface ApiStorageProps {
  savedLocally?: boolean;
  savedAt?: string;
}

// Interface for monthly absence data
export interface MonthlyAbsenceData {
  count: number;
  days: number;
  hours: number;
}
