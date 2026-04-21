import { apiRequest } from './client.js';
import { getKitchenRestaurantId } from '../services/authStorage.js';

function isUsableKitchenOrderId(value) {
  if (value == null) {
    return false;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value !== 'string') {
    return false;
  }

  return value.trim().length > 0;
}

function isNumericKitchenOrderId(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value !== 'string') {
    return false;
  }

  return /^\d+$/.test(value.trim());
}

function pickKitchenOrderId(order, keys) {
  if (!order || typeof order !== 'object') {
    return null;
  }

  for (const key of keys) {
    if (!(key in order)) {
      continue;
    }

    const value = order[key];
    if (isNumericKitchenOrderId(value)) {
      return value;
    }
  }

  for (const key of keys) {
    if (!(key in order)) {
      continue;
    }

    const value = order[key];
    if (isUsableKitchenOrderId(value)) {
      return value;
    }
  }

  return null;
}

export function resolveKitchenOrderActionId(order) {
  const direct = pickKitchenOrderId(order, [
    'id',
    'orderId',
    'order_id',
    'dbId',
    'databaseId',
    'database_id',
    'backendId',
    'backend_id',
    'kitchenOrderId',
    'kitchen_order_id',
  ]);
  if (direct != null) {
    return direct;
  }

  const alternate = pickKitchenOrderId(order, [
    'orderNumber',
    'order_number',
    'displayId',
    'display_id',
    'reference',
    'referenceNumber',
    'reference_number',
  ]);
  return alternate;
}

function getKitchenRestaurantIdOrThrow() {
  const restaurantId = getKitchenRestaurantId();
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }

  return restaurantId;
}

export function fetchRestaurants() {
  return apiRequest('/restaurants');
}

export function fetchRestaurantMenu(id) {
  return apiRequest(`/restaurants/${id}/menu`);
}

export function submitOrder(payload) {
  return apiRequest('/orders', { method: 'POST', body: payload });
}

export function startOrderVerification(payload) {
  return apiRequest('/orders/verification/start', {
    method: 'POST',
    body: payload,
  });
}

export function resendOrderVerification(payload) {
  return apiRequest('/orders/verification/resend', {
    method: 'POST',
    body: payload,
  });
}

export function confirmOrderVerification(payload) {
  return apiRequest('/orders/verification/confirm', {
    method: 'POST',
    body: payload,
  });
}

export function fetchOrderById(id) {
  return apiRequest(`/orders/${id}`);
}

export function fetchOrders() {
  return apiRequest('/orders');
}

export function fetchOrdersByStatus(status) {
  const restaurantId = getKitchenRestaurantIdOrThrow();
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest(`/dashboard/restaurants/${encodeURIComponent(restaurantId)}/orders${query}`);
}

function getKitchenActionRequest(orderId, status, options = {}) {
  getKitchenRestaurantIdOrThrow();

  const actionPaths = {
    accepted: `/dashboard/orders/${encodeURIComponent(orderId)}/accept`,
    partially_accepted: `/dashboard/orders/${encodeURIComponent(orderId)}/partial-accept`,
    preparing: `/dashboard/orders/${encodeURIComponent(orderId)}/preparing`,
    ready_for_pickup: `/dashboard/orders/${encodeURIComponent(orderId)}/ready`,
    completed: `/dashboard/orders/${encodeURIComponent(orderId)}/complete`,
    rejected: `/dashboard/orders/${encodeURIComponent(orderId)}/reject`,
  };

  const path = actionPaths[status];
  if (!path) {
    throw new Error(`Unsupported kitchen status: ${status}`);
  }

  const body =
    status === 'rejected'
      ? { reject_reason: options.rejectReason || 'Rejected from kitchen dashboard' }
        : status === 'partially_accepted'
        ? {
            accepted_item_ids: Array.isArray(options.accepted_item_ids || options.acceptedItemIds)
              ? options.accepted_item_ids || options.acceptedItemIds
              : [],
            unavailable_item_ids: Array.isArray(options.unavailable_item_ids || options.unavailableItemIds)
              ? options.unavailable_item_ids || options.unavailableItemIds
              : [],
            note: options.note || undefined,
          }
        : undefined;

  return { path, body };
}

export function updateOrderStatus(orderId, status, options = {}) {
  const request = getKitchenActionRequest(orderId, status, options);

  return apiRequest(request.path, {
    method: 'PATCH',
    ...(request.body ? { body: request.body } : {}),
  });
}
