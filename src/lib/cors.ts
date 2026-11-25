export function embedCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function optionsResponse(req: Request) {
  return new Response(null, {
    status: 204,
    headers: embedCorsHeaders(req.headers.get("origin")),
  });
}
