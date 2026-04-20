const ACCESS_TOKEN_KEY = 'go2pik.accessToken';
const REFRESH_TOKEN_KEY = 'go2pik.refreshToken';
const PROFILE_KEY = 'go2pik.profile';
const KITCHEN_ACCESS_TOKEN_KEY = 'go2pik.kitchenAccessToken';
const KITCHEN_REFRESH_TOKEN_KEY = 'go2pik.kitchenRefreshToken';
const KITCHEN_PROFILE_KEY = 'go2pik.kitchenProfile';
const AUTH_NOTICE_KEY = 'go2pik.authNotice';
const KITCHEN_AUTH_NOTICE_KEY = 'go2pik.kitchenAuthNotice';
const CUSTOMER_GUEST_ACCESS_KEY = 'go2pik.customerGuestAccess';
const VERIFIED_CUSTOMER_PHONE_KEY = 'go2pik.verifiedCustomerPhone';
const CUSTOMER_ORDER_DRAFT_KEY = 'go2pik.customerOrderDraft';
const CUSTOMER_ORDER_VERIFICATION_KEY = 'go2pik.customerOrderVerification';

function safeStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function readJson(storage, key) {
  const raw = storage?.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to parse cached ${key}`, error);
    storage?.removeItem(key);
    return null;
  }
}

function writeJson(storage, key, value) {
  if (!storage) {
    return;
  }

  if (value == null) {
    storage.removeItem(key);
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

export function getAuthToken() {
  const storage = safeStorage();
  return storage?.getItem(ACCESS_TOKEN_KEY) || null;
}

export function getRefreshToken() {
  const storage = safeStorage();
  return storage?.getItem(REFRESH_TOKEN_KEY) || null;
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
  storage?.removeItem(VERIFIED_CUSTOMER_PHONE_KEY);
}

export function setAuthNotice(message) {
  const storage = safeStorage();
  if (!storage) return;
  if (message) {
    storage.setItem(AUTH_NOTICE_KEY, message);
  } else {
    storage.removeItem(AUTH_NOTICE_KEY);
  }
}

export function consumeAuthNotice() {
  const storage = safeStorage();
  const message = storage?.getItem(AUTH_NOTICE_KEY) || '';
  storage?.removeItem(AUTH_NOTICE_KEY);
  return message;
}

export function hasCustomerGuestAccess() {
  const storage = safeStorage();
  return storage?.getItem(CUSTOMER_GUEST_ACCESS_KEY) === 'true';
}

export function setCustomerGuestAccess(enabled) {
  const storage = safeStorage();
  if (!storage) return;
  if (enabled) {
    storage.setItem(CUSTOMER_GUEST_ACCESS_KEY, 'true');
  } else {
    storage.removeItem(CUSTOMER_GUEST_ACCESS_KEY);
  }
}

export function clearCustomerGuestAccess() {
  const storage = safeStorage();
  storage?.removeItem(CUSTOMER_GUEST_ACCESS_KEY);
}

export function getCustomerOrderDraft() {
  const storage = safeStorage();
  return readJson(storage, CUSTOMER_ORDER_DRAFT_KEY);
}

export function storeCustomerOrderDraft(draft) {
  const storage = safeStorage();
  writeJson(storage, CUSTOMER_ORDER_DRAFT_KEY, draft);
}

export function clearCustomerOrderDraft() {
  const storage = safeStorage();
  storage?.removeItem(CUSTOMER_ORDER_DRAFT_KEY);
}

export function getCustomerOrderVerification() {
  const storage = safeStorage();
  return readJson(storage, CUSTOMER_ORDER_VERIFICATION_KEY);
}

export function storeCustomerOrderVerification(verification) {
  const storage = safeStorage();
  writeJson(storage, CUSTOMER_ORDER_VERIFICATION_KEY, verification);
}

export function clearCustomerOrderVerification() {
  const storage = safeStorage();
  storage?.removeItem(CUSTOMER_ORDER_VERIFICATION_KEY);
}

export function getVerifiedCustomerPhone() {
  const storage = safeStorage();
  return storage?.getItem(VERIFIED_CUSTOMER_PHONE_KEY) || null;
}

export function setVerifiedCustomerPhone(phone) {
  const storage = safeStorage();
  if (!storage) return;
  if (phone) {
    storage.setItem(VERIFIED_CUSTOMER_PHONE_KEY, String(phone));
  } else {
    storage.removeItem(VERIFIED_CUSTOMER_PHONE_KEY);
  }
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

export function setKitchenAuthNotice(message) {
  const storage = safeStorage();
  if (!storage) return;
  if (message) {
    storage.setItem(KITCHEN_AUTH_NOTICE_KEY, message);
  } else {
    storage.removeItem(KITCHEN_AUTH_NOTICE_KEY);
  }
}

export function consumeKitchenAuthNotice() {
  const storage = safeStorage();
  const message = storage?.getItem(KITCHEN_AUTH_NOTICE_KEY) || '';
  storage?.removeItem(KITCHEN_AUTH_NOTICE_KEY);
  return message;
}
