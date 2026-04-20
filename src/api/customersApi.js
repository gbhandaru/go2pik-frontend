import { apiRequest } from './client.js';

function normalizeCustomerOrdersResponse(response) {
  if (!response || typeof response !== 'object') {
    return { customer: null, orders: [] };
  }

  return {
    customer: response.customer || response.data?.customer || null,
    orders:
      response.orders ||
      response.data?.orders ||
      response.items ||
      response.data?.items ||
      [],
  };
}

export function sendWelcomeEmail(customerId) {
  if (!customerId) {
    return Promise.reject(new Error('customerId is required to send welcome email'));
  }

  const encodedId = encodeURIComponent(customerId);
  return apiRequest(`/customers/${encodedId}/welcome-email`, {
    method: 'POST',
  });
}

export function fetchCustomerOrders(customerId, options = {}) {
  if (!customerId) {
    return Promise.reject(new Error('customerId is required'));
  }

  return apiRequest(`/customers/${encodeURIComponent(customerId)}/orders`).then(normalizeCustomerOrdersResponse);
}
