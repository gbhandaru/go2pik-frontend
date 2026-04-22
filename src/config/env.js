export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  FRONTEND_BASE_URL: import.meta.env.VITE_FRONTEND_BASE_URL || '',
  OTP_LENGTH: normalizePositiveInteger(import.meta.env.VITE_OTP_LENGTH, 6),
};

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
