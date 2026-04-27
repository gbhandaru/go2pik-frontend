import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  customerLogin,
  customerLogout,
  customerSignup,
  fetchCustomerProfile,
  customerRefreshSession,
} from '../api/authApi.js';
import { sendWelcomeEmail } from '../api/customersApi.js';
import {
  clearAuthTokens,
  clearCustomerGuestAccess,
  getAuthToken,
  hasCustomerGuestAccess,
  getRefreshToken,
  setCustomerGuestAccess,
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

function resolveCustomerProfile(response) {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const directProfile = response.user || response.customer || response.profile;
  if (directProfile) {
    return directProfile;
  }

  const nestedKeys = ['data', 'attributes', 'result', 'payload', 'details'];
  for (const key of nestedKeys) {
    const nestedProfile = resolveCustomerProfile(response[key]);
    if (nestedProfile) {
      return nestedProfile;
    }
  }

  return null;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    loading: true,
    error: null,
    sessionMode: 'loading',
  });

  useEffect(() => {
    let cancelled = false;

    function waitForAuthBootstrap(delayMs = 250) {
      return new Promise((resolve) => {
        window.setTimeout(resolve, delayMs);
      });
    }

    async function hydrate() {
      const token = getAuthToken();
      const refreshToken = getRefreshToken();
      if (!token && !refreshToken) {
        await waitForAuthBootstrap();
        if (cancelled) {
          return;
        }

        const nextToken = getAuthToken();
        const nextRefreshToken = getRefreshToken();
        if (nextToken || nextRefreshToken) {
          if (nextToken) {
            const profileResponse = await fetchCustomerProfile();
            if (cancelled) {
              return;
            }
            const profile = resolveCustomerProfile(profileResponse) || profileResponse;
            storeAuthTokens({ accessToken: nextToken, profile });
            clearCustomerGuestAccess();
            setState({ user: profile, loading: false, error: null, sessionMode: 'authenticated' });
            return;
          }

          const response = await customerRefreshSession(nextRefreshToken);
          if (cancelled) {
            return;
          }
          clearCustomerGuestAccess();
          const profile = resolveCustomerProfile(response);
          storeAuthTokens({
            accessToken: response?.access_token,
            refreshToken: response?.refresh_token,
            profile,
          });
          setState({
            user: profile,
            loading: false,
            error: null,
            sessionMode: profile ? 'authenticated' : 'anonymous',
          });
          return;
        }

        const guestMode = hasCustomerGuestAccess();
        if (!guestMode) {
          clearAuthTokens();
        }
        setState({
          user: null,
          loading: false,
          error: null,
          sessionMode: guestMode ? 'guest' : 'anonymous',
        });
        return;
      }
      try {
        if (token) {
          const profileResponse = await fetchCustomerProfile();
          if (cancelled) {
            return;
          }
          const profile = resolveCustomerProfile(profileResponse) || profileResponse;
          storeAuthTokens({ accessToken: token, profile });
          clearCustomerGuestAccess();
          setState({ user: profile, loading: false, error: null, sessionMode: 'authenticated' });
          return;
        }

        const response = await customerRefreshSession(refreshToken);
        if (cancelled) {
          return;
        }
        clearCustomerGuestAccess();
        const profile = resolveCustomerProfile(response);
        storeAuthTokens({
          accessToken: response?.access_token,
          refreshToken: response?.refresh_token,
          profile,
        });
        setState({
          user: profile,
          loading: false,
          error: null,
          sessionMode: profile ? 'authenticated' : 'anonymous',
        });
      } catch (error) {
        clearAuthTokens();
        clearCustomerGuestAccess();
        setState({ user: null, loading: false, error: null, sessionMode: 'anonymous' });
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      clearCustomerGuestAccess();
      setState({ user: null, loading: false, error: null, sessionMode: 'anonymous' });
    };

    window.addEventListener('go2pik:auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('go2pik:auth-expired', handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    const handleAuthUpdated = (event) => {
      const profile = event.detail?.profile || null;
      if (!profile) {
        return;
      }

      storeAuthTokens({ profile });
      setState((prev) => ({
        ...prev,
        user: profile,
        loading: false,
        error: null,
        sessionMode: prev.sessionMode === 'guest' ? 'guest' : 'authenticated',
      }));
    };

    window.addEventListener('go2pik:auth-updated', handleAuthUpdated);
    return () => {
      window.removeEventListener('go2pik:auth-updated', handleAuthUpdated);
    };
  }, []);

  const value = useMemo(() => ({
    ...state,
    isAuthenticated: state.sessionMode === 'authenticated',
    isGuest: state.sessionMode === 'guest',
    canAccessCustomerFlow: state.sessionMode === 'authenticated' || state.sessionMode === 'guest',
    login: async (credentials) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        clearCustomerGuestAccess();
        const response = await customerLogin(credentials);
        const profile = resolveCustomerProfile(response);
        storeAuthTokens({
          accessToken: response?.access_token,
          refreshToken: response?.refresh_token,
          profile,
        });
        setState({
          user: profile,
          loading: false,
          error: null,
          sessionMode: profile ? 'authenticated' : 'anonymous',
        });
        return response;
      } catch (error) {
        setState({ user: null, loading: false, error: error.message, sessionMode: 'anonymous' });
        throw error;
      }
    },
    signup: async (payload) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        clearCustomerGuestAccess();
        const response = await customerSignup(payload);
        const profile = resolveCustomerProfile(response);
        storeAuthTokens({
          accessToken: response?.access_token,
          refreshToken: response?.refresh_token,
          profile,
        });
        setState({
          user: profile,
          loading: false,
          error: null,
          sessionMode: profile ? 'authenticated' : 'anonymous',
        });
        notifyWelcomeEmail(response);
        return response;
      } catch (error) {
        setState({ user: null, loading: false, error: error.message, sessionMode: 'anonymous' });
        throw error;
      }
    },
    continueAsGuest: () => {
      clearAuthTokens();
      setCustomerGuestAccess(true);
      setState({ user: null, loading: false, error: null, sessionMode: 'guest' });
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
      clearCustomerGuestAccess();
      setState({ user: null, loading: false, error: null, sessionMode: 'anonymous' });
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
