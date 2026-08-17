type UnknownRecord = Record<string, unknown>;

export type MailchimpFieldError = {
  field: string;
  message: string;
};

export type MailchimpProblem = {
  status: number;
  title: string;
  detail: string;
  field?: string;
  fieldErrors: MailchimpFieldError[];
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function responseBody(error: unknown): UnknownRecord | undefined {
  if (!isRecord(error) || !isRecord(error.response) || !isRecord(error.response.body)) {
    return undefined;
  }
  return error.response.body;
}

export function mailchimpStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  return numberValue(error.status) ?? numberValue(error.statusCode) ?? numberValue(error.response);
}

export function normalizeMailchimpError(error: unknown): MailchimpProblem {
  const body = responseBody(error);
  const rawErrors = body && Array.isArray(body.errors) ? body.errors : [];
  const fieldErrors = rawErrors.flatMap((entry): MailchimpFieldError[] => {
    if (!isRecord(entry)) return [];
    const field = stringValue(entry.field);
    const message = stringValue(entry.message);
    return field && message ? [{ field, message }] : [];
  });
  const status = numberValue(body?.status) ?? mailchimpStatus(error) ?? 500;
  const detail =
    stringValue(body?.detail) ??
    (error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "Mailchimp request failed");

  return {
    status,
    title: stringValue(body?.title) ?? "Mailchimp error",
    detail,
    ...(fieldErrors[0] ? { field: fieldErrors[0].field } : {}),
    fieldErrors,
  };
}

export function isMailchimpRateLimit(error: unknown): boolean {
  return normalizeMailchimpError(error).status === 429;
}
