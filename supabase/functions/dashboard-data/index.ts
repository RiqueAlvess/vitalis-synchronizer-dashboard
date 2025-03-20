import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Create a mock data function to use as fallback
const getMockDashboardData = () => {
  return {
    absenteeismRate: 3.42,
    totalAbsenceDays: 128,
    employeesAbsent: 15,
    costImpact: 'R$ 4.250,00',
    trend: 'down',
    monthlyTrend: [
      { month: 'Jan', value: 4.2 },
      { month: 'Fev', value: 3.8 },
      { month: 'Mar', value: 3.42 }
    ],
    bySector: [
      { name: 'Administrativo', value: 2.8, count: 5 },
      { name: 'Operacional', value: 4.1, count: 7 },
      { name: 'TI', value: 1.9, count: 3 }
    ],
    topCIDs: [
      { cid: 'J11', description: 'Síndrome gripal', count: 8, percentage: 35 },
      { cid: 'M54', description: 'Dorsalgia', count: 5, percentage: 22 },
      { cid: 'F32', description: 'Episódios depressivos', count: 2, percentage: 8 }
    ]
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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      log('Missing authorization header');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing authorization header',
          code: 'auth/unauthorized'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Extract token (remove Bearer prefix if it exists)
    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client with the token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Get user data to verify the token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      log('User verification error', userError);
      
      // Return mock data for development purposes
      log('Returning mock data due to authentication error');
      return new Response(
        JSON.stringify(getMockDashboardData()),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    log(`Authenticated as user: ${user.email} (${user.id})`);
    
    // For now, just return mock data as placeholder
    // In a production environment, you'd query real data from the database
    log('Returning mock dashboard data');
    
    return new Response(
      JSON.stringify(getMockDashboardData()),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error in dashboard-data function:', error);
    
    // Return mock data even on error to keep the UI functional
    return new Response(
      JSON.stringify(getMockDashboardData()),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
