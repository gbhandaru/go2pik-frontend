import { ENV } from '../config/env.js';
import { clearAuthTokens, clearKitchenAuthTokens } from '../services/authStorage.js';
import {
  getAuthToken,
  getKitchenAuthToken,
  getKitchenRefreshToken,
  getRefreshToken,
  storeAuthTokens,
  storeKitchenAuthTokens,
} from '../services/authStorage.js';

function getActiveToken() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (pathname.startsWith('/kitchen/')) {
    return getKitchenAuthToken() || getAuthToken();
  }

  return getAuthToken();
}

function getActiveRefreshToken() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (pathname.startsWith('/kitchen/')) {
    return getKitchenRefreshToken() || getRefreshToken();
  }

  return getRefreshToken();
}

function getRefreshEndpoint() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  return pathname.startsWith('/kitchen/')
    ? '/auth/restaurant-users/refresh'
    : '/auth/customers/refresh';
}

function emitAuthEvent(type, message) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(type, {
      detail: { message },
    }),
  );
}

async function refreshActiveSession() {
  const refreshToken = getActiveRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${ENV.API_BASE_URL}${getRefreshEndpoint()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      return false;
    }

    const accessToken = data?.access_token || data?.accessToken || null;
    const nextRefreshToken = data?.refresh_token || data?.refreshToken || null;
    const profile = data?.user || data?.profile || null;
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

    if (pathname.startsWith('/kitchen/')) {
      storeKitchenAuthTokens({
        accessToken,
        refreshToken: nextRefreshToken,
        profile,
      });
    } else {
      storeAuthTokens({
        accessToken,
        refreshToken: nextRefreshToken,
        profile,
      });
    }

    emitAuthEvent('go2pik:auth-renewed', 'Session renewed.');
    return Boolean(accessToken);
  } catch {
    return false;
  }
}

export async function apiRequest(path, options = {}) {
  const token = options.auth === false ? null : getActiveToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const body = options.body
    ? typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body)
    : undefined;

  const url = `${ENV.API_BASE_URL}${path}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || data?.message || 'API request failed';
    if ((response.status === 401 || response.status === 403) && options.auth !== false && !options._retried) {
      const refreshed = await refreshActiveSession();
      if (refreshed) {
        return apiRequest(path, { ...options, _retried: true });
      }
    }

    if (response.status === 401 || response.status === 403) {
      clearAuthTokens();
      clearKitchenAuthTokens();
      emitAuthEvent('go2pik:auth-expired', 'Session expired. Please sign in again.');
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}
