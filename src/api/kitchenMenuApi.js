import { apiRequest } from './client.js';
import { getKitchenRestaurantId } from '../services/authStorage.js';

function resolveRestaurantId(explicitRestaurantId) {
  return explicitRestaurantId || getKitchenRestaurantId() || null;
}

function normalizeMenuItems(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === 'object') {
    if (Array.isArray(response.items)) {
      return response.items;
    }

    if (Array.isArray(response.menu)) {
      return response.menu;
    }

    if (response.data && typeof response.data === 'object') {
      if (Array.isArray(response.data.items)) {
        return response.data.items;
      }

      if (Array.isArray(response.data.menu)) {
        return response.data.menu;
      }
    }
  }

  return [];
}

function normalizeCategories(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === 'object') {
    if (Array.isArray(response.categories)) {
      return response.categories;
    }

    if (response.data && typeof response.data === 'object' && Array.isArray(response.data.categories)) {
      return response.data.categories;
    }
  }

  return [];
}

function normalizeExportResponse(response) {
  if (response && typeof response === 'object') {
    return {
      restaurant: response.restaurant || response.data?.restaurant || null,
      categories: normalizeCategories(response.categories || response.data?.categories || []),
      uncategorized_items: response.uncategorized_items || response.data?.uncategorized_items || [],
    };
  }

  return {
    restaurant: null,
    categories: [],
    uncategorized_items: [],
  };
}

export async function fetchKitchenMenuItems(restaurantId) {
  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  const response = await apiRequest(
    `/dashboard/restaurants/${encodeURIComponent(resolvedRestaurantId)}/menu`,
  );

  return {
    restaurant: response?.restaurant || response?.data?.restaurant || null,
    items: normalizeMenuItems(response),
  };
}

export async function fetchKitchenMenuCategories(restaurantId) {
  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  const response = await apiRequest(
    `/dashboard/restaurants/${encodeURIComponent(resolvedRestaurantId)}/menu/categories`,
  );

  return normalizeCategories(response);
}

export function createKitchenMenuItem(restaurantId, payload) {
  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  return apiRequest(`/dashboard/restaurants/${encodeURIComponent(resolvedRestaurantId)}/menu`, {
    method: 'POST',
    body: payload,
  });
}

export function updateKitchenMenuItem(menuItemId, payload) {
  if (!menuItemId) {
    throw new Error('menuItemId is required');
  }

  return apiRequest(`/dashboard/menu-items/${encodeURIComponent(menuItemId)}`, {
    method: 'PUT',
    body: payload,
  });
}

export function toggleKitchenMenuItemAvailability(menuItemId, payload) {
  if (!menuItemId) {
    throw new Error('menuItemId is required');
  }

  return apiRequest(`/dashboard/menu-items/${encodeURIComponent(menuItemId)}/availability`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteKitchenMenuItem(menuItemId) {
  if (!menuItemId) {
    throw new Error('menuItemId is required');
  }

  return apiRequest(`/dashboard/menu-items/${encodeURIComponent(menuItemId)}`, {
    method: 'DELETE',
  });
}

export function createKitchenMenuCategory(restaurantId, payload) {
  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  return apiRequest(
    `/dashboard/restaurants/${encodeURIComponent(resolvedRestaurantId)}/menu/categories`,
    {
      method: 'POST',
      body: payload,
    },
  );
}

export function updateKitchenMenuCategory(restaurantId, categoryId, payload) {
  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }
  if (!categoryId) {
    throw new Error('categoryId is required');
  }

  return apiRequest(
    `/dashboard/restaurants/${encodeURIComponent(resolvedRestaurantId)}/menu/categories/${encodeURIComponent(categoryId)}`,
    {
      method: 'PUT',
      body: payload,
    },
  );
}

export function fetchKitchenMenuExport(restaurantId) {
  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  return apiRequest(`/dashboard/restaurants/${encodeURIComponent(resolvedRestaurantId)}/menu/export`).then(
    normalizeExportResponse,
  );
}

export function importKitchenMenu(restaurantId, payload) {
  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  return apiRequest(`/dashboard/restaurants/${encodeURIComponent(resolvedRestaurantId)}/menu/import`, {
    method: 'POST',
    body: payload,
  });
}

export function importKitchenMenuCsv(restaurantId, csvText) {
  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  return apiRequest(`/dashboard/restaurants/${encodeURIComponent(resolvedRestaurantId)}/menu/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
    },
    body: csvText,
  });
}
