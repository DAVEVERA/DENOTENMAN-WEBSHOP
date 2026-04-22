export interface ApiErrorBody {
  code: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static fromResponse(status: number, body: unknown): ApiError {
    if (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      typeof (body as ApiErrorBody).code === "string"
    ) {
      const b = body as ApiErrorBody;
      return new ApiError(
        status,
        b.code,
        b.message ?? `Request failed with status ${status}`,
        b.details,
      );
    }
    return new ApiError(status, "UNKNOWN", `Request failed with status ${status}`, body);
  }
}
