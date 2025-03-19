import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // Create a Supabase client with the Admin key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Handle login request
    if (path === 'login' && req.method === 'POST') {
      const { email, password } = await req.json();
      
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, message: error.message }),
          {
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }

      // Set secure cookie with the session token
      const cookieOptions = [
        `auth_token=${data.session?.access_token}`,
        'Max-Age=3600', // 1 hour
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
      ];

      if (url.hostname !== 'localhost') {
        cookieOptions.push('Secure');
      }

      // Get user profile data
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const userData = {
        id: data.user.id,
        email: data.user.email,
        fullName: profileData?.full_name || data.user.user_metadata?.full_name || 'Usuário',
        companyName: profileData?.company_name || data.user.user_metadata?.company_name || 'Empresa',
        jobTitle: profileData?.job_title || data.user.user_metadata?.job_title,
        isPremium: profileData?.is_premium || false,
      };

      return new Response(
        JSON.stringify({ success: true, user: userData }),
        {
          headers: {
            ...corsHeaders(req),
            'Content-Type': 'application/json',
            'Set-Cookie': cookieOptions.join('; '),
          },
          status: 200,
        }
      );
    }

    // Handle logout request
    if (path === 'logout' && req.method === 'POST') {
      // Clear the auth cookie
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            ...corsHeaders(req),
            'Content-Type': 'application/json',
            'Set-Cookie': 'auth_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
          },
          status: 200,
        }
      );
    }

    // Handle session validation
    if (path === 'validate' && req.method === 'GET') {
      // Extract token from cookie
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        return new Response(
          JSON.stringify({ success: false, message: 'No authentication token found' }),
          {
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }

      // Verify the token
      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !data.user) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid or expired token' }),
          {
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }

      // Get user profile data
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const userData = {
        id: data.user.id,
        email: data.user.email,
        fullName: profileData?.full_name || data.user.user_metadata?.full_name || 'Usuário',
        companyName: profileData?.company_name || data.user.user_metadata?.company_name || 'Empresa',
        jobTitle: profileData?.job_title || data.user.user_metadata?.job_title,
        isPremium: profileData?.is_premium || false,
      };

      return new Response(
        JSON.stringify({ success: true, user: userData }),
        {
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // If no valid path is matched
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid endpoint' }),
      {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  } catch (error) {
    console.error('Error:', error.message);
    
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
