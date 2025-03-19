
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Initialize admin Supabase client
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Verify the token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    // Check if user exists
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Return mock dashboard data for now
    return new Response(
      JSON.stringify({
        absenteeismRate: 3.42,
        totalAbsenceDays: 156,
        employeesAbsent: 23,
        costImpact: 'R$ 12.450,00',
        trend: 'up',
        monthlyTrend: [
          { month: 'Jan', value: 2.1 },
          { month: 'Fev', value: 2.5 },
          { month: 'Mar', value: 3.1 },
          { month: 'Abr', value: 2.8 },
          { month: 'Mai', value: 3.2 },
          { month: 'Jun', value: 3.42 }
        ],
        bySector: [
          { name: 'Administrativo', value: 2.1, count: 5 },
          { name: 'Comercial', value: 3.7, count: 8 },
          { name: 'Operacional', value: 4.2, count: 10 },
          { name: 'TI', value: 1.5, count: 2 }
        ],
        topCIDs: [
          { code: 'J11', description: 'Influenza', count: 12 },
          { code: 'M54', description: 'Dorsalgia', count: 8 },
          { code: 'F41', description: 'Transtornos ansiosos', count: 6 }
        ]
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
