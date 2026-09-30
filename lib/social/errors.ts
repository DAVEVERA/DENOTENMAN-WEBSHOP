export class SocialError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    /** A later attempt may succeed (rate limits, timeouts, platform hiccups). */
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "SocialError";
  }
}
