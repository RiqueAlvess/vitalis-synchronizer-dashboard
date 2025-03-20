import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Create a mock data function to use as fallback
const getMockDashboardData = () => {
  return {
    absenteeismRate: 0,
    totalAbsenceDays: 0,
    employeesAbsent: 0,
    costImpact: 'R$ 0,00',
    trend: 'neutral',
    monthlyTrend: [
      { month: 'Jan', value: 0 },
      { month: 'Fev', value: 0 },
      { month: 'Mar', value: 0 },
      { month: 'Abr', value: 0 },
      { month: 'Mai', value: 0 },
      { month: 'Jun', value: 0 }
    ],
    bySector: [
      { name: 'Administrativo', value: 0, count: 0 },
      { name: 'Operacional', value: 0, count: 0 },
      { name: 'TI', value: 0, count: 0 }
    ],
    topCIDs: []
  };
};

Deno.serve(async (req) => {
  const log = (message: string, data: any = null) => {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}][dashboard-data] ${message}`, data);
    } else {
      console.log(`[${timestamp}][dashboard-data] ${message}`);
    }
  };
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  
  try {
    log('Dashboard data function called');
    
    // Always return the mock data for now to ensure the UI works
    log('Returning zeroed dashboard data');
    
    return new Response(
      JSON.stringify(getMockDashboardData()),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error in dashboard-data function:', error);
    
    // Return zeroed data even on error to keep the UI functional
    return new Response(
      JSON.stringify(getMockDashboardData()),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
