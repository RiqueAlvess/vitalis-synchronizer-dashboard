
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Cache settings
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
type EmployeeCache = {
  data: any[];
  timestamp: number;
  userId: string;
};

// In-memory cache
const employeeCache = new Map<string, EmployeeCache>();

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  
  try {
    // Get query parameters
    const url = new URL(req.url);
    const skipCache = url.searchParams.get('skipCache') === 'true';
    const syncMode = url.searchParams.get('sync') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header in employees request');
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Extract token (remove Bearer prefix if it exists)
    const token = authHeader.replace('Bearer ', '');
    console.log(`Got token with length: ${token.length}`);
    
    // Initialize Supabase client
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
      console.error('User verification error:', userError);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Authenticated user: ${user.id}, email: ${user.email}`);
    
    // Check if sync mode is requested - redirect to sync endpoint
    if (syncMode) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Sync mode is deprecated in this endpoint. Use the dedicated sync-soc-data endpoint instead.',
          code: 'USE_SYNC_ENDPOINT'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Check if we have a valid cache entry
    const cacheKey = `employees_${user.id}`;
    const now = Date.now();
    const cachedData = employeeCache.get(cacheKey);
    
    if (!skipCache && cachedData && now - cachedData.timestamp < CACHE_TTL) {
      console.log(`Returning cached employee data for user ${user.id}, found ${cachedData.data.length} records`);
      const paginatedData = cachedData.data.slice(offset, offset + limit);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: paginatedData,
          count: cachedData.data.length,
          offset,
          limit,
          cached: true,
          cacheAge: Math.round((now - cachedData.timestamp) / 1000)
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Fetching employees for user ${user.id} from database`);
    
    // Fetch employees from the database with pagination
    const { data: employees, error: fetchError, count } = await supabase
      .from('employees')
      .select(`
        id, 
        soc_code,
        company_soc_code,
        company_name,
        full_name,
        unit_name,
        sector_name,
        position_name,
        employee_registration,
        cpf,
        status,
        gender,
        birth_date,
        hire_date,
        termination_date,
        email,
        mobile_phone
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);
    
    if (fetchError) {
      console.error('Error fetching employees:', fetchError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error fetching employees', error: fetchError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`Found ${employees?.length || 0} employees (count: ${count || 0}) for user ${user.id}`);
    
    // If this was a full fetch (offset 0), update the cache
    if (offset === 0) {
      // Only cache if we have a reasonable number of records (don't cache huge datasets)
      if (count && count < 10000 && Array.isArray(employees)) {
        employeeCache.set(cacheKey, {
          data: employees,
          timestamp: now,
          userId: user.id
        });
        console.log(`Updated cache for user ${user.id} with ${employees.length} employees`);
      } else {
        console.log(`Not caching data for user ${user.id} due to large dataset size (${count} records) or invalid data`);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: employees || [],
        count,
        offset,
        limit,
        cached: false
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error in employees endpoint:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Erro interno no servidor', error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Clean expired cache entries every hour
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  employeeCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL) {
      employeeCache.delete(key);
      expiredCount++;
    }
  });
  
  if (expiredCount > 0) {
    console.log(`Cleaned ${expiredCount} expired employee cache entries`);
  }
}, 60 * 60 * 1000);
