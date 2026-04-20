import { apiRequest } from './client.js';
import { clearAuthTokens, getAuthToken } from '../services/authStorage.js';
import { normalizeAppError } from '../utils/appError.js';

async function safeRequest(path, options = {}) {
  try {
    return await apiRequest(path, options);
  } catch (error) {
    throw normalizeAppError(error, error?.message || 'Request failed');
  }
}

export function customerSignup(payload) {
  return safeRequest('/auth/customers/signup', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function customerLogin(payload) {
  return safeRequest('/auth/customers/login', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function customerRefreshSession(refreshToken) {
  return safeRequest('/auth/customers/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    auth: false,
  });
}

export function updateCustomerPassword(payload) {
  return safeRequest('/auth/customers/profile', {
    method: 'PUT',
    body: payload,
  });
}

export function updateCustomerPhone(payload) {
  return safeRequest('/customers/me/phone', {
    method: 'PATCH',
    body: payload,
  });
}

export function customerLogout(refreshToken) {
  return safeRequest('/auth/customers/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    auth: false,
  });
}

export async function fetchCustomerProfile() {
  const token = getAuthToken();
  if (!token) {
    throw normalizeAppError({ message: 'Missing token', kind: 'auth' }, 'Missing token');
  }
  try {
    return await safeRequest('/auth/customers/me');
  } catch (error) {
    clearAuthTokens();
    throw error;
  }
}

export function restaurantUserLogin(payload) {
  return safeRequest('/auth/restaurant-users/login', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function restaurantUserRefreshSession(refreshToken) {
  return safeRequest('/auth/restaurant-users/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    auth: false,
  });
}

export function restaurantUserLogout(refreshToken) {
  return safeRequest('/auth/restaurant-users/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    auth: false,
  });
}

export function fetchRestaurantProfile() {
  return safeRequest('/auth/restaurant-users/me');
}

export function createRestaurantUser(restaurantId, payload) {
  const normalizedRestaurantId = String(restaurantId || '').trim();
  if (!normalizedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  if (!/^\d+$/.test(normalizedRestaurantId)) {
    throw new Error('Restaurant ID must be numeric.');
  }

  return safeRequest(`/restaurants/${normalizedRestaurantId}/users`, {
    method: 'POST',
    body: payload,
  });
}
