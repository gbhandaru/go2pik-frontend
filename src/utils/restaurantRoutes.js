import { ENV } from '../config/env.js';

export function resolveRestaurantRouteKey(source) {
  if (source == null) {
    return '';
  }

  if (typeof source === 'string' || typeof source === 'number') {
    const value = String(source).trim();
    return value;
  }

  if (typeof source !== 'object') {
    return '';
  }

  const candidates = [
    source.restaurantRouteKey,
    source.restaurant_route_key,
    source.slug,
    source.restaurantSlug,
    source.restaurant_slug,
    source.menuSlug,
    source.menu_slug,
    source.restaurantId,
    source.restaurant_id,
    source.id,
  ];

  for (const candidate of candidates) {
    if (candidate == null) {
      continue;
    }

    const value = String(candidate).trim();
    if (value) {
      return value;
    }
  }

  return '';
}

export function getRestaurantMenuPath(source) {
  const routeKey = resolveRestaurantRouteKey(source);
  return routeKey ? `/restaurant/${encodeURIComponent(routeKey)}` : '/home';
}

export function getRestaurantQrDestinationUrl(source) {
  const routeKey = resolveRestaurantRouteKey(source);
  if (!routeKey) {
    return '';
  }

  const baseUrl = getFrontendBaseUrl();
  if (!baseUrl) {
    return '';
  }

  return new URL(`/restaurant/${encodeURIComponent(routeKey)}`, baseUrl).toString();
}

export function matchesRestaurantRouteKey(source, routeKey) {
  const sourceKey = resolveRestaurantRouteKey(source);
  const nextKey = resolveRestaurantRouteKey(routeKey);
  return Boolean(sourceKey && nextKey && sourceKey === nextKey);
}

function getFrontendBaseUrl() {
  const configuredBaseUrl = String(ENV.FRONTEND_BASE_URL || '').trim();
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  return '';
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}
