
export interface DashboardData {
  absenteeismRate: number;
  totalAbsenceDays: number; 
  employeesAbsent: number;
  costImpact: string;
  trend: 'up' | 'down' | 'stable' | 'neutral';
  monthlyTrend: {
    month: string;
    value: number; // Changed from 'rate' to 'value' to match usage
  }[];
  bySector: {
    name: string;    // Changed from 'sector' to 'name' to match usage
    value: number;   // Changed from 'rate' to 'value' to match usage
    count?: number;  // Made optional
  }[];
  topCIDs?: {
    cid: string;
    description: string;
    count: number;
    percentage: number;
  }[];
}

// Define types for mock data
export interface MockEmployeeData {
  id?: number;
  employee_id?: string;  // Added this property to fix the error
  name?: string;
  full_name?: string;
  position?: string;
  position_name?: string;
  sector?: string;
  sector_name?: string;
  status?: string;
  absentDays?: number;
}

// Add API configuration interfaces with savedLocally property
export interface ApiStorageProps {
  savedLocally?: boolean;
  savedAt?: string;
}

// Interface for monthly absence data
export interface MonthlyTrendData {
  month: string;
  value: number;
}

export interface SectorData {
  name: string;
  value: number;
  count?: number;
}
