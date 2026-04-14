import { apiRequest } from './client.js';
import { mockKitchenOrders, mockOrders, mockRestaurants } from './mockData.js';

let kitchenOrdersState = mockKitchenOrders.map((order) => ({ ...order }));

function getMockKitchenOrders(status) {
  if (!status) {
    return kitchenOrdersState;
  }
  return kitchenOrdersState.filter((order) => order.status === status);
}

function updateMockKitchenOrderStatus(orderId, status) {
  const index = kitchenOrdersState.findIndex((order) => order.id === orderId);
  if (index === -1) {
    return { id: orderId, status };
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
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return withFallback(`/orders${query}`, undefined, () => getMockKitchenOrders(status));
}

export function updateOrderStatus(orderId, status) {
  return withFallback(
    `/orders/${orderId}/status`,
    { method: 'PATCH', body: { status } },
    () => updateMockKitchenOrderStatus(orderId, status),
  );
}
