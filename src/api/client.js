import { ENV } from '../config/env.js';
import {
  clearAuthTokens,
  clearKitchenAuthTokens,
  setAuthNotice,
  setKitchenAuthNotice,
} from '../services/authStorage.js';
import {
  getAuthToken,
  getKitchenAuthToken,
  getKitchenRefreshToken,
  getRefreshToken,
  storeAuthTokens,
  storeKitchenAuthTokens,
} from '../services/authStorage.js';
import { createAppError, normalizeAppError } from '../utils/appError.js';

function getActiveToken() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (pathname.startsWith('/kitchen/') || pathname.startsWith('/restaurant/')) {
    return getKitchenAuthToken() || getAuthToken();
  }

  return getAuthToken();
}

function getActiveRefreshToken() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (pathname.startsWith('/kitchen/') || pathname.startsWith('/restaurant/')) {
    return getKitchenRefreshToken() || getRefreshToken();
  }

  return getRefreshToken();
}

function getRefreshEndpoint() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  return pathname.startsWith('/kitchen/') || pathname.startsWith('/restaurant/')
    ? '/auth/restaurant-users/refresh'
    : '/auth/customers/refresh';
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
    const profile = data?.user || data?.customer || data?.profile || null;
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

    if (pathname.startsWith('/kitchen/') || pathname.startsWith('/restaurant/')) {
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
    return Boolean(accessToken);
  } catch {
    return false;
  }
}

export async function apiRequest(path, options = {}) {
  const token = options.auth === false ? null : getActiveToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const body = options.body
    ? typeof options.body === 'string'
      ? options.body
      : isFormData
        ? options.body
        : JSON.stringify(options.body)
    : undefined;

  const url = `${ENV.API_BASE_URL}${path}`;

  let response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      cache: 'no-store',
    });
  } catch (error) {
    throw normalizeAppError(error, 'Unable to reach the server. Please try again.');
  }

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
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      if (pathname.startsWith('/kitchen/') || pathname.startsWith('/restaurant/')) {
        setKitchenAuthNotice('Session expired. Please sign in again.');
      } else {
        setAuthNotice('Session expired. Please sign in again.');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('go2pik:auth-expired'));
      }
    }
    throw createAppError(message, {
      status: response.status,
      code: data?.code || data?.errorCode || null,
      kind:
        response.status === 401 || response.status === 403
          ? 'auth'
          : response.status === 404
            ? 'not_found'
            : response.status === 422 || response.status === 400
              ? 'validation'
              : response.status >= 500
                ? 'server_error'
                : 'http_error',
      retryable: response.status >= 500,
      details: data?.details || null,
    });
  }

  return data;
}
