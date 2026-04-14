import { apiRequest } from './client.js';
import { mockKitchenOrders, mockOrders, mockRestaurants } from './mockData.js';
import { getKitchenRestaurantId } from '../services/authStorage.js';

let kitchenOrdersState = mockKitchenOrders.map((order) => ({ ...order }));

function getMockKitchenOrders(restaurantId, status) {
  return kitchenOrdersState.filter((order) => {
    const matchesRestaurant = !restaurantId || order.restaurantId === restaurantId;
    const matchesStatus = !status || order.status === status;
    return matchesRestaurant && matchesStatus;
  });
}

function updateMockKitchenOrderStatus(restaurantId, orderId, status) {
  const index = kitchenOrdersState.findIndex(
    (order) => order.id === orderId && (!restaurantId || order.restaurantId === restaurantId),
  );
  if (index === -1) {
    return { id: orderId, restaurantId, status };
  }
  const updated = { ...kitchenOrdersState[index], status };
  kitchenOrdersState[index] = updated;
  return updated;
}

async function withFallback(path, options, fallback) {
  try {
    return await apiRequest(path, options);
  } catch (error) {
    console.warn(`[api] Falling back for ${path}:`, error.message);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

export function fetchRestaurants() {
  return withFallback('/restaurants', undefined, mockRestaurants);
}

export function fetchRestaurantMenu(id) {
  return withFallback(`/restaurants/${id}/menu`, undefined, () => {
    const restaurant = mockRestaurants.find((r) => r.id === id);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    return { restaurant, menu: restaurant.menu };
  });
}

export function submitOrder(payload) {
  return withFallback(
    '/orders',
    { method: 'POST', body: payload },
    () => ({
      id: `mock-${Date.now()}`,
      status: 'received',
      placedAt: new Date().toISOString(),
      ...payload,
    }),
  );
}

export function fetchOrderById(id) {
  return withFallback(`/orders/${id}`, undefined, () => {
    const order = mockOrders.find((item) => item.id === id);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  });
}

export function fetchOrders() {
  return withFallback('/orders', undefined, mockOrders);
}

export function fetchOrdersByStatus(status) {
  const restaurantId = getKitchenRestaurantId() || mockRestaurants[0]?.id;
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }

  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return withFallback(
    `/dashboard/restaurants/${encodeURIComponent(restaurantId)}/orders${query}`,
    undefined,
    () => getMockKitchenOrders(restaurantId, status),
  );
}

export function updateOrderStatus(orderId, status) {
  const restaurantId = getKitchenRestaurantId() || mockRestaurants[0]?.id;
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }

  return withFallback(
    `/dashboard/restaurants/${encodeURIComponent(restaurantId)}/orders/${orderId}/status`,
    { method: 'PATCH', body: { status } },
    () => updateMockKitchenOrderStatus(restaurantId, orderId, status),
  );
}
