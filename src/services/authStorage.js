const ACCESS_TOKEN_KEY = 'go2pik.accessToken';
const REFRESH_TOKEN_KEY = 'go2pik.refreshToken';
const PROFILE_KEY = 'go2pik.profile';
const KITCHEN_ACCESS_TOKEN_KEY = 'go2pik.kitchenAccessToken';
const KITCHEN_REFRESH_TOKEN_KEY = 'go2pik.kitchenRefreshToken';
const KITCHEN_PROFILE_KEY = 'go2pik.kitchenProfile';

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

export function getKitchenAuthToken() {
  const storage = safeStorage();
  return storage?.getItem(KITCHEN_ACCESS_TOKEN_KEY) || null;
}

export function getKitchenRefreshToken() {
  const storage = safeStorage();
  return storage?.getItem(KITCHEN_REFRESH_TOKEN_KEY) || null;
}

export function getStoredKitchenProfile() {
  const storage = safeStorage();
  const data = storage?.getItem(KITCHEN_PROFILE_KEY);
  if (!data) {
    return null;
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to parse cached kitchen profile', error);
    storage?.removeItem(KITCHEN_PROFILE_KEY);
    return null;
  }
}

function extractKitchenRestaurantId(value) {
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

  const directKeys = [
    'restaurantId',
    'restaurant_id',
    'restaurantID',
    'restaurantUuid',
    'restaurant_uuid',
  ];

  for (const key of directKeys) {
    if (key in value) {
      const direct = extractKitchenRestaurantId(value[key]);
      if (direct) {
        return direct;
      }
    }
  }

  const nestedKeys = ['restaurant', 'restaurant_data', 'restaurantData', 'data', 'profile', 'user'];
  for (const key of nestedKeys) {
    if (key in value) {
      const nested = extractKitchenRestaurantId(value[key]);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function getKitchenRestaurantId() {
  return extractKitchenRestaurantId(getStoredKitchenProfile());
}

export function storeKitchenAuthTokens({ accessToken, refreshToken, profile }) {
  const storage = safeStorage();
  if (!storage) return;
  if (accessToken) {
    storage.setItem(KITCHEN_ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    storage.setItem(KITCHEN_REFRESH_TOKEN_KEY, refreshToken);
  }
  if (profile) {
    storage.setItem(KITCHEN_PROFILE_KEY, JSON.stringify(profile));
  }
}

export function clearKitchenAuthTokens() {
  const storage = safeStorage();
  storage?.removeItem(KITCHEN_ACCESS_TOKEN_KEY);
  storage?.removeItem(KITCHEN_REFRESH_TOKEN_KEY);
  storage?.removeItem(KITCHEN_PROFILE_KEY);
}
