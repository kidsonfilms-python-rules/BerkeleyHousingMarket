export function GET(request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    name: "Outta the Units agent marketplace API",
    version: "1.0",
    endpoints: {
      listings: `${origin}/api/marketplace/reports`,
      purchaseIntent: `${origin}/api/agents/purchase`
    },
    note: "Purchase endpoints return unsigned transaction requests. Agents retain wallet custody and sign transactions themselves."
  });
}
