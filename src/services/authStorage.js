const ACCESS_TOKEN_KEY = 'go2pik.accessToken';
const REFRESH_TOKEN_KEY = 'go2pik.refreshToken';
const PROFILE_KEY = 'go2pik.profile';

function safeStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

export function getAuthToken() {
  const storage = safeStorage();
  return storage?.getItem(ACCESS_TOKEN_KEY) || null;
}

export function getRefreshToken() {
  const storage = safeStorage();
  return storage?.getItem(REFRESH_TOKEN_KEY) || null;
}

export function getStoredProfile() {
  const storage = safeStorage();
  const data = storage?.getItem(PROFILE_KEY);
  if (!data) {
    return null;
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to parse cached profile', error);
    storage?.removeItem(PROFILE_KEY);
    return null;
  }
}

export function storeAuthTokens({ accessToken, refreshToken, profile }) {
  const storage = safeStorage();
  if (!storage) return;
  if (accessToken) {
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  if (profile) {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
}

export function clearAuthTokens() {
  const storage = safeStorage();
  storage?.removeItem(ACCESS_TOKEN_KEY);
  storage?.removeItem(REFRESH_TOKEN_KEY);
  storage?.removeItem(PROFILE_KEY);
}
