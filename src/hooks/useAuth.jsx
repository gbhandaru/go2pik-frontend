import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  customerLogin,
  customerLogout,
  customerSignup,
  fetchCustomerProfile,
} from '../api/authApi.js';
import { sendWelcomeEmail } from '../api/customersApi.js';
import {
  clearAuthTokens,
  getAuthToken,
  getRefreshToken,
  getStoredProfile,
  storeAuthTokens,
} from '../services/authStorage.js';

const AuthContext = createContext(null);

const DIRECT_ID_KEYS = [
  'customerId',
  'customer_id',
  'customerID',
  'id',
  'customerRef',
  'customer_ref',
  'customerUuid',
  'customer_uuid',
];

const NESTED_ID_KEYS = ['customer', 'profile', 'user', 'data', 'attributes', 'result'];

function extractCustomerId(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized || null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  for (const key of DIRECT_ID_KEYS) {
    if (key in value) {
      const direct = extractCustomerId(value[key]);
      if (direct) {
        return direct;
      }
    }
  }

  for (const nestedKey of NESTED_ID_KEYS) {
    if (nestedKey in value) {
      const nested = extractCustomerId(value[nestedKey]);
      if (nested) {
        return nested;
      }
    }
  }

  const entries = Array.isArray(value) ? value : Object.values(value);
  for (const entry of entries) {
    const match = extractCustomerId(entry);
    if (match) {
      return match;
    }
  }

  return null;
}

function notifyWelcomeEmail(payload) {
  const customerId = extractCustomerId(payload);
  if (!customerId) {
    return;
  }
  sendWelcomeEmail(customerId).catch((error) => {
    console.warn('Failed to send welcome email', error);
  });
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: getStoredProfile(),
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function hydrate() {
      const token = getAuthToken();
      if (!token) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      try {
        const profile = await fetchCustomerProfile();
        storeAuthTokens({ accessToken: token, profile });
        setState({ user: profile, loading: false, error: null });
      } catch (error) {
        clearAuthTokens();
        setState({ user: null, loading: false, error: error.message });
      }
    }

    hydrate();
  }, []);

  const value = useMemo(() => ({
    ...state,
    isAuthenticated: Boolean(state.user),
    login: async (credentials) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const response = await customerLogin(credentials);
        storeAuthTokens({
          accessToken: response?.access_token,
          refreshToken: response?.refresh_token,
          profile: response?.user,
        });
        setState({ user: response?.user || null, loading: false, error: null });
        return response;
      } catch (error) {
        setState({ user: null, loading: false, error: error.message });
        throw error;
      }
    },
    signup: async (payload) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const response = await customerSignup(payload);
        storeAuthTokens({
          accessToken: response?.access_token,
          refreshToken: response?.refresh_token,
          profile: response?.user,
        });
        setState({ user: response?.user || null, loading: false, error: null });
        notifyWelcomeEmail(response);
        return response;
      } catch (error) {
        setState({ user: null, loading: false, error: error.message });
        throw error;
      }
    },
    logout: async () => {
      const refreshToken = getRefreshToken();
      try {
        if (refreshToken) {
          await customerLogout(refreshToken);
        }
      } catch (error) {
        console.warn('Failed to notify server about logout', error);
      }
      clearAuthTokens();
      setState({ user: null, loading: false, error: null });
    },
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
