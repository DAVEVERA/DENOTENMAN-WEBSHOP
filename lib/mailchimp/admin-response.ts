import { NextResponse } from "next/server";
import { normalizeMailchimpError } from "@/lib/mailchimp/errors";

export function mailchimpErrorResponse(error: unknown): NextResponse {
  const problem = normalizeMailchimpError(error);
  const status = problem.status >= 400 && problem.status <= 599 ? problem.status : 502;
  return NextResponse.json(
    {
      error: "MAILCHIMP_ERROR",
      message: problem.detail,
      fieldErrors: problem.fieldErrors,
    },
    { status }
  );
}
