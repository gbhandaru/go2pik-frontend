import { ENV } from "../config/env";
import { getAuthToken } from "../services/authStorage";

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();

  const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "API request failed");
  }

  return data;
}
