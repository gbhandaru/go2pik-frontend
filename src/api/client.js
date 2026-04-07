import { ENV } from '../config/env.js';
import { getAuthToken } from '../services/authStorage.js';

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();
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
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}
