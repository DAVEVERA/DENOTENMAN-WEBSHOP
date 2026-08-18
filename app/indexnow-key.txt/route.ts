import { readIndexNowConfig } from "@/lib/indexnow";

export function GET(): Response {
  const config = readIndexNowConfig();
  if (!config) return new Response("Not found", { status: 404 });

  return new Response(config.key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
