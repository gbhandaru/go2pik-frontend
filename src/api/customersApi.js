import { apiRequest } from './client.js';

export function sendWelcomeEmail(customerId) {
  if (!customerId) {
    return Promise.reject(new Error('customerId is required to send welcome email'));
  }

  const encodedId = encodeURIComponent(customerId);
  return apiRequest(`/customers/${encodedId}/welcome-email`, {
    method: 'POST',
  });
}
