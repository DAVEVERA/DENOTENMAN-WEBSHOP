import type { NextRequest } from "next/server";
import { handleFaqStatus } from "@/lib/product-faq-route-handlers";
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string; faqId: string }> }) { return handleFaqStatus(request, params, "HIDDEN"); }
