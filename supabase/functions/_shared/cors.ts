
export const corsHeaders = (req?: Request) => {
  // Get the origin from the request or use '*' as fallback
  const origin = req?.headers?.get('Origin') || '*';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Origin, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};
