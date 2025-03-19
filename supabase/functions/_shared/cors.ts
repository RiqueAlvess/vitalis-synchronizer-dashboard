
export const corsHeaders = (req: Request) => {
  // Get the origin from the request or use '*' as fallback
  const origin = req.headers.get('Origin') || '*';
  
  // Define allowed origins - add more as needed
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://preview--vitalis-synchronizer-dashboard.lovable.app'
  ];
  
  // Check if the request origin is in our allowed list or use '*' in development
  const finalOrigin = allowedOrigins.includes(origin) ? origin : '*';
  
  return {
    'Access-Control-Allow-Origin': finalOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
};
