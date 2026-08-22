import { recordProductView } from "@/lib/product-metrics";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === new URL(request.url).origin && fetchSite === "same-origin";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || id.length > 100) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const recorded = await recordProductView(id);
    return new Response(null, {
      status: recorded ? 204 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to record storefront product view", { id, error });
    return Response.json({ error: "View unavailable" }, { status: 503 });
  }
}
