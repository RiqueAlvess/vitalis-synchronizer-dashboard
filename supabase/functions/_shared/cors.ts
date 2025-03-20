
// _shared/cors.ts
export const corsHeaders = (req?: Request) => {
  // Use the Origin header if available, otherwise allow all origins
  const origin = req?.headers.get('Origin') || '*';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-time',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};
