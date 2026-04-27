import { apiRequest } from './client.js';

export function validatePromotion(payload) {
  return apiRequest('/promotions/validate', {
    method: 'POST',
    body: payload,
  });
}
