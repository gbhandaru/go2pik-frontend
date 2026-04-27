const DEFAULT_CUSTOMER_HOME_PATH = '/home';

export function resolveCustomerPostLoginPath(pathname, fallbackPath = DEFAULT_CUSTOMER_HOME_PATH) {
  const nextPath = String(pathname || '').trim();
  if (!nextPath) {
    return fallbackPath;
  }

  const normalizedPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  if (normalizedPath === '/' || isCustomerAuthPath(normalizedPath)) {
    return fallbackPath;
  }

  return normalizedPath;
}

export function resolveCustomerGuestPath(pathname, fallbackPath = DEFAULT_CUSTOMER_HOME_PATH) {
  const nextPath = String(pathname || '').trim();
  if (!nextPath) {
    return fallbackPath;
  }

  const normalizedPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  if (normalizedPath === '/' || isCustomerAuthPath(normalizedPath)) {
    return fallbackPath;
  }

  return normalizedPath;
}

export function getCustomerHomePath() {
  return DEFAULT_CUSTOMER_HOME_PATH;
}

export function getCustomerOrdersPath() {
  return '/orders';
}

export function buildCustomerLoginState(pathname = DEFAULT_CUSTOMER_HOME_PATH, guestPath = DEFAULT_CUSTOMER_HOME_PATH) {
  return {
    from: {
      pathname: resolveCustomerPostLoginPath(pathname),
    },
    guestTo: {
      pathname: resolveCustomerGuestPath(guestPath),
    },
  };
}

function isCustomerAuthPath(pathname) {
  return [
    '/login',
    '/signup',
    '/password-update',
    '/verification',
    '/order-confirmation',
  ].includes(pathname);
}
