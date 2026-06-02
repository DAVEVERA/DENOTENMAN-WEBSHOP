import { Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";

/**
 * Global exception filter that forwards every unhandled exception to Sentry
 * before delegating to the default NestJS exception handler.
 *
 * Registered as APP_FILTER in AppModule so it wraps the entire application.
 * HttpException subclasses with a 4xx status are still forwarded — Sentry
 * ignores events below its configured threshold, but the filter does not
 * make that decision (observability over noise).
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    // Skip 4xx client errors — these are expected and do not indicate bugs.
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      super.catch(exception, host);
      return;
    }

    Sentry.captureException(exception);
    super.catch(exception, host);
  }
}
