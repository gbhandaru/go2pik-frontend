const RETRYABLE_KINDS = new Set(['network', 'timeout', 'offline', 'server_error']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractMessage(error) {
  if (typeof error === 'string') {
    return error.trim();
  }

  if (isPlainObject(error)) {
    return (
      (typeof error.userMessage === 'string' && error.userMessage.trim()) ||
      (typeof error.message === 'string' && error.message.trim()) ||
      (typeof error.error === 'string' && error.error.trim()) ||
      ''
    );
  }

  return '';
}

function classifyStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 422 || status === 400) return 'validation';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

function detectOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function detectAbort(error) {
  return error?.name === 'AbortError' || error?.code === 20;
}

function detectNetworkError(error) {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const message = extractMessage(error).toLowerCase();
  return message.includes('failed to fetch') || message.includes('network error');
}

export function normalizeAppError(error, fallbackMessage = 'Something went wrong. Please try again.') {
  if (error?.__appError === true) {
    return error;
  }

  const status = Number.isFinite(error?.status) ? error.status : null;
  const offline = detectOffline();
  const aborted = detectAbort(error);
  const network = detectNetworkError(error);
  const kind =
    error?.kind ||
    (offline ? 'offline' : null) ||
    (aborted ? 'aborted' : null) ||
    (network ? 'network' : null) ||
    classifyStatus(status || 0) ||
    'unknown';
  const message = extractMessage(error) || fallbackMessage;
  const code = typeof error?.code === 'string' ? error.code : null;
  const details = isPlainObject(error?.details) ? error.details : null;
  const retryable =
    typeof error?.retryable === 'boolean'
      ? error.retryable
      : RETRYABLE_KINDS.has(kind) || status >= 500 || kind === 'unknown';

  const normalized = new Error(message);
  normalized.__appError = true;
  normalized.kind = kind;
  normalized.status = status;
  normalized.code = code;
  normalized.retryable = retryable;
  normalized.details = details;
  normalized.originalError = error instanceof Error ? error : null;
  normalized.offline = offline;
  normalized.aborted = aborted;
  normalized.userMessage = message;

  return normalized;
}

export function createAppError(message, options = {}) {
  return normalizeAppError(
    {
      message,
      ...options,
    },
    message,
  );
}

export function getFriendlyErrorMessage(error, fallbackMessage = 'Something went wrong. Please try again.') {
  return normalizeAppError(error, fallbackMessage).message;
}
