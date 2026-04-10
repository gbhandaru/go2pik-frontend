import { apiRequest } from './client.js';
import { clearAuthTokens, getAuthToken } from '../services/authStorage.js';

async function safeRequest(path, options = {}) {
  try {
    return await apiRequest(path, options);
  } catch (error) {
    throw new Error(error.message || 'Request failed');
  }
}

export function customerSignup(payload) {
  return safeRequest('/auth/customers/signup', {
    method: 'POST',
    body: payload,
  });
}

export function customerLogin(payload) {
  return safeRequest('/auth/customers/login', {
    method: 'POST',
    body: payload,
  });
}

export function updateCustomerPassword(payload) {
  return safeRequest('/auth/customers/profile', {
    method: 'PUT',
    body: payload,
  });
}

export function customerLogout(refreshToken) {
  return safeRequest('/auth/customers/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}

export async function fetchCustomerProfile() {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Missing token');
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
  });
}

export function fetchRestaurantProfile() {
  return safeRequest('/auth/restaurant-users/me');
}
