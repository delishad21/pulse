import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export const Errors = {
  NotFound: (resource = "Resource") => new AppError("NOT_FOUND", `${resource} not found.`, 404),
  Unauthorized: () => new AppError("UNAUTHORIZED", "Unauthorized.", 401),
  Forbidden: () => new AppError("FORBIDDEN", "Forbidden.", 403),
  Validation: (message: string, details?: Record<string, unknown>) =>
    new AppError("VALIDATION_ERROR", message, 400, details),
  Conflict: (message: string) => new AppError("CONFLICT", message, 409),
};

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError("INTERNAL_ERROR", error.message, 500);
  return new AppError("INTERNAL_ERROR", "Unknown error.", 500);
}

export async function registerErrorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: unknown, _request: FastifyRequest, reply: FastifyReply) => {
    const appError = handleError(error);
    reply.status(appError.status).send(appError.toJSON());
  });
}
