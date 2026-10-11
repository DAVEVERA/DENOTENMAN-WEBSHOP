import { buildLlmsTxt } from "@/lib/llms-discovery";
import { BASE_URL } from "@/lib/routes";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsTxt(BASE_URL), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      Link: '</llms.txt>; rel="describedby"; type="text/markdown"',
    },
  });
}
