import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '@trellis/contracts';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.id;

  if (err instanceof AppError) {
    const errorResponse: ApiError = {
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
    };
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  if (err instanceof ZodError) {
    const errorResponse: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Request payload validation failed.',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      requestId,
    };
    res.status(400).json(errorResponse);
    return;
  }

  if (
    (err as any).type === 'entity.too.large' ||
    err.name === 'PayloadTooLargeError' ||
    (err as any).status === 413
  ) {
    const errorResponse: ApiError = {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds the 1MB limit.',
      requestId,
    };
    res.status(413).json(errorResponse);
    return;
  }

  // Redacted structured error log (never logs authorization tokens or private keys)
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.path,
      errorName: err.name,
      errorMessage: err.message,
    })
  );

  const errorResponse: ApiError = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal error occurred. Please try again later.',
    requestId,
  };
  res.status(500).json(errorResponse);
}
