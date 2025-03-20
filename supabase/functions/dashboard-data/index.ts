
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders, logWithContext, syncErrorResponse, ERROR_CODES } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Cache settings
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
type DashboardCache = {
  data: any;
  timestamp: number;
  userId: string;
  syncTimestamp?: string; // Latest sync timestamp that generated this data
};

// In-memory cache
const dashboardCache = new Map<string, DashboardCache>();

Deno.serve(async (req) => {
  const log = (message, data = null) => logWithContext('dashboard-data', message, data);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  
  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return syncErrorResponse(req, 'Missing authorization header', 401, null, ERROR_CODES.UNAUTHORIZED);
    }
    
    // Extract token (remove Bearer prefix if it exists)
    const token = authHeader.replace('Bearer ', '');
    
    // Get URL parameters
    const url = new URL(req.url);
    const skipCache = url.searchParams.get('skipCache') === 'true';
    const refreshData = url.searchParams.get('refresh') === 'true';
    
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
      return syncErrorResponse(req, 'Invalid authentication token', 401, userError, ERROR_CODES.UNAUTHORIZED);
    }
    
    log(`Authenticated as user: ${user.email} (${user.id})`);
    
    // Check if user has any data at all (to prevent unnecessary processing)
    const { count: employeeCount, error: countError } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .limit(1);
    
    if (countError) {
      log('Error checking employee count', countError);
      return syncErrorResponse(req, 'Error checking data availability', 500, countError, ERROR_CODES.DB_ERROR);
    }
    
    if (employeeCount === 0) {
      log('No employee data found for this user');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No data available. Please sync your data first.',
          hasData: false,
          absenteeismStats: {
            totalAbsenteeismHours: 0,
            totalAbsenteeismDays: 0,
            totalEmployees: 0,
            totalAbsenteeismRecords: 0,
            absenteeismRate: 0,
            financialImpact: 0,
            topAbsenteeismSectors: [],
            topAbsenteeismICDs: []
          },
          cached: false
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get most recent sync timestamp to check if cache should be invalidated
    const { data: recentSyncs, error: syncError } = await supabase
      .from('sync_logs')
      .select('completed_at')
      .eq('user_id', user.id)
      .in('status', ['completed', 'completed_with_errors'])
      .order('completed_at', { ascending: false })
      .limit(1);
    
    const latestSyncTimestamp = recentSyncs && recentSyncs.length > 0 ? recentSyncs[0].completed_at : null;
    
    // Check if we have a valid and unexpired cache entry
    const cacheKey = `dashboard_${user.id}`;
    const now = Date.now();
    const cachedData = dashboardCache.get(cacheKey);
    
    const cacheValid = cachedData && 
                       now - cachedData.timestamp < CACHE_TTL && 
                       (!refreshData) && 
                       (!skipCache) &&
                       (!latestSyncTimestamp || cachedData.syncTimestamp === latestSyncTimestamp);
    
    if (cacheValid) {
      log(`Returning cached dashboard data for user ${user.id}`);
      return new Response(
        JSON.stringify({
          ...cachedData.data,
          cached: true,
          cacheAge: Math.round((now - cachedData.timestamp) / 1000)
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }
    
    log(`Generating fresh dashboard data for user ${user.id}`);
    
    // Calculate absenteeism statistics with query timeout protection
    const absenteeismPromise = (async () => {
      // Set a timeout for the database operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 30000);
      });
      
      const resultsPromise = Promise.all([
        // Get total absenteeism hours and days
        supabase
          .from('absenteeism')
          .select('hours_absent, days_absent')
          .eq('user_id', user.id),
        
        // Calculate total active employees
        supabase
          .from('employees')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('status', 'Ativo'),
        
        // Get total absenteeism records
        supabase
          .from('absenteeism')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        
        // Get top absenteeism sectors
        supabase
          .from('absenteeism')
          .select('sector, days_absent')
          .eq('user_id', user.id)
          .not('sector', 'is', null),
        
        // Get top absenteeism ICDs
        supabase
          .from('absenteeism')
          .select('primary_icd, icd_description, days_absent')
          .eq('user_id', user.id)
          .not('primary_icd', 'is', null)
      ]);
      
      return Promise.race([resultsPromise, timeoutPromise]);
    })();
    
    try {
      const [
        { data: absenteeismHoursDays, error: absError },
        { count: totalEmployees, error: empError },
        { count: totalAbsenteeismRecords, error: absRecError },
        { data: sectorData, error: sectorError },
        { data: icdData, error: icdError }
      ] = await absenteeismPromise;
      
      if (absError || empError || absRecError || sectorError || icdError) {
        throw new Error('Database query error');
      }
      
      // Process the results
      const totalAbsenteeismHours = absenteeismHoursDays.reduce((sum, item) => {
        // Convert hours in format "HH:MM" to decimal
        if (item.hours_absent) {
          const [hours, minutes] = item.hours_absent.split(':').map(Number);
          return sum + (hours + minutes / 60);
        }
        return sum;
      }, 0);
      
      const totalAbsenteeismDays = absenteeismHoursDays.reduce((sum, item) => 
        sum + (item.days_absent || 0), 0);
      
      // Calculate absenteeism rate: (total hours absent / total work hours) * 100
      // Assuming 220 work hours per month per employee
      const totalWorkHours = (totalEmployees || 1) * 220; // Prevent division by zero
      const absenteeismRate = (totalAbsenteeismHours / totalWorkHours) * 100;
      
      // Calculate financial impact: hours absent * average hourly wage
      // Using base minimum wage in Brazil as reference (R$ 1320 per month / 220 hours)
      const hourlyWage = 1320 / 220; // Approximately R$ 6 per hour
      const financialImpact = totalAbsenteeismHours * hourlyWage;
      
      // Process top sectors
      const sectorMap = new Map();
      sectorData.forEach(item => {
        if (item.sector) {
          const current = sectorMap.get(item.sector) || 0;
          sectorMap.set(item.sector, current + (item.days_absent || 0));
        }
      });
      
      const topAbsenteeismSectors = Array.from(sectorMap.entries())
        .map(([sector, days]) => ({ sector, days }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 10);
      
      // Process top ICDs
      const icdMap = new Map();
      icdData.forEach(item => {
        if (item.primary_icd) {
          const key = item.primary_icd;
          const description = item.icd_description || 'Sem descrição';
          const current = icdMap.get(key) || { days: 0, description };
          icdMap.set(key, { 
            days: current.days + (item.days_absent || 0),
            description 
          });
        }
      });
      
      const topAbsenteeismICDs = Array.from(icdMap.entries())
        .map(([icd, { days, description }]) => ({ icd, days, description }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 10);
      
      // Prepare the response data
      const responseData = {
        success: true,
        hasData: true,
        absenteeismStats: {
          totalAbsenteeismHours,
          totalAbsenteeismDays,
          totalEmployees: totalEmployees || 0,
          totalAbsenteeismRecords: totalAbsenteeismRecords || 0,
          absenteeismRate: Number(absenteeismRate.toFixed(2)),
          financialImpact: Number(financialImpact.toFixed(2)),
          topAbsenteeismSectors,
          topAbsenteeismICDs
        },
        cached: false,
        generated: new Date().toISOString()
      };
      
      // Cache the result
      dashboardCache.set(cacheKey, {
        data: responseData,
        timestamp: now,
        userId: user.id,
        syncTimestamp: latestSyncTimestamp
      });
      
      log(`Generated and cached dashboard data for user ${user.id}`);
      
      return new Response(
        JSON.stringify(responseData),
        { 
          status: 200, 
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    } catch (dbError) {
      log('Error processing dashboard data', dbError);
      return syncErrorResponse(req, 'Error generating dashboard data', 500, dbError, ERROR_CODES.DATA_PROCESSING_ERROR);
    }
  } catch (error) {
    log('Unexpected error', error);
    return syncErrorResponse(req, 'Unexpected error', 500, error, ERROR_CODES.UNKNOWN_ERROR);
  }
});

// Cleanup expired cache entries every hour
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  dashboardCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL) {
      dashboardCache.delete(key);
      expiredCount++;
    }
  });
  
  if (expiredCount > 0) {
    console.log(`[${new Date().toISOString()}] Cleaned ${expiredCount} expired dashboard cache entries`);
  }
}, 60 * 60 * 1000);
