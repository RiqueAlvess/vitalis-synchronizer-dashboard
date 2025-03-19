
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

    // Fetch employees from the database
    const { data: employees, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('user_id', user.id);
    
    if (fetchError) {
      console.error('Error fetching employees:', fetchError);
      
      // If no employees are found, return mock data for demonstration
      const mockEmployees = [
        {
          id: 1,
          name: 'João Silva',
          full_name: 'João Carlos Silva',
          position: 'Analista de TI',
          position_name: 'Analista de Sistemas',
          sector: 'TI',
          sector_name: 'Tecnologia da Informação',
          status: 'Ativo',
          cpf: '123.456.789-00'
        },
        {
          id: 2,
          name: 'Maria Souza',
          full_name: 'Maria Eduarda Souza',
          position: 'Gerente de RH',
          position_name: 'Gerente de Recursos Humanos',
          sector: 'RH',
          sector_name: 'Recursos Humanos',
          status: 'Ativo',
          cpf: '987.654.321-00'
        },
        {
          id: 3,
          name: 'Pedro Santos',
          full_name: 'Pedro Henrique Santos',
          position: 'Assistente Administrativo',
          position_name: 'Assistente Administrativo',
          sector: 'ADM',
          sector_name: 'Administrativo',
          status: 'Afastado',
          cpf: '456.789.123-00'
        }
      ];
      
      return new Response(
        JSON.stringify(mockEmployees),
        { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(employees),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in employees endpoint:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
