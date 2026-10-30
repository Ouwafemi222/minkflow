export const ERROR_CODES = {
  UNAUTHENTICATED: { status: 401, retryable: false, message: 'Please sign in to continue.' },
  FORBIDDEN: { status: 403, retryable: false, message: 'You do not have access to this resource.' },
  NOT_FOUND: { status: 404, retryable: false, message: 'The requested item was not found.' },
  VALIDATION_FAILED: { status: 400, retryable: false, message: 'Some fields are invalid.' },
  IDEMPOTENCY_KEY_REQUIRED: { status: 400, retryable: false, message: 'Missing Idempotency-Key header.' },
  REVISION_CONFLICT: {
    status: 409,
    retryable: false,
    message: 'This project changed in another tab. Reload to see the latest version.',
  },
  INVALID_STATE: { status: 409, retryable: false, message: 'This action is not available right now.' },
  INSUFFICIENT_CREDITS: { status: 402, retryable: false, message: 'Not enough credits for this action.' },
  RATE_LIMITED: { status: 429, retryable: true, message: 'Too many requests. Please wait a moment.' },
  QUOTA_EXCEEDED: { status: 429, retryable: false, message: 'You have reached your current usage limit.' },
  CONCURRENCY_LIMIT: { status: 429, retryable: true, message: 'Too many jobs are running. Try again soon.' },
  SPEND_CAP_REACHED: {
    status: 503,
    retryable: true,
    message: 'Generation is paused temporarily. Please try again later.',
  },
  CONTENT_REJECTED: { status: 422, retryable: false, message: 'This request violates the content policy.' },
  UNSUPPORTED_UPLOAD: { status: 415, retryable: false, message: 'This file type or size is not supported.' },
  PROVIDER_UNAVAILABLE: {
    status: 503,
    retryable: true,
    message: 'An AI provider is unavailable. Your credits were not charged.',
  },
  PROVIDER_RATE_LIMITED: { status: 503, retryable: true, message: 'The AI provider is busy. Retrying shortly.' },
  AI_OUTPUT_INVALID: {
    status: 502,
    retryable: true,
    message: 'The AI returned an unusable result. You can retry.',
  },
  ALIGNMENT_UNRELIABLE: {
    status: 502,
    retryable: true,
    message: 'Voice timing could not be aligned. Please retry.',
  },
  RENDER_FAILED: { status: 500, retryable: true, message: 'The render failed. Your credits were refunded.' },
  RENDER_QC_FAILED: {
    status: 500,
    retryable: true,
    message: 'The video failed quality checks. Your credits were refunded.',
  },
  JOB_CANCELED: { status: 409, retryable: false, message: 'This job was canceled.' },
  WEBHOOK_INVALID: { status: 401, retryable: false, message: 'Invalid webhook signature.' },
  PAYMENTS_UNAVAILABLE: { status: 503, retryable: false, message: 'Payments are not enabled yet.' },
  INTERNAL: { status: 500, retryable: true, message: 'Something went wrong on our side.' },
} as const satisfies Record<string, { status: number; retryable: boolean; message: string }>;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? ERROR_CODES[code].message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.status = ERROR_CODES[code].status;
    this.retryable = ERROR_CODES[code].retryable;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export interface ErrorEnvelope {
  code: ErrorCode;
  message: string;
  requestId: string;
  retryable: boolean;
  details?: unknown;
}

export function toErrorEnvelope(error: unknown, requestId: string): { status: number; body: ErrorEnvelope } {
  const appError = isAppError(error) ? error : new AppError('INTERNAL');
  const body: ErrorEnvelope = {
    code: appError.code,
    message: appError.message,
    requestId,
    retryable: appError.retryable,
  };
  if (appError.details !== undefined) body.details = appError.details;
  return { status: appError.status, body };
}
