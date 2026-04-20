import { useCallback, useEffect, useState } from 'react';
import { fetchOrdersByStatus } from '../api/ordersApi.js';

function normalizeOrdersResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === 'object') {
    const candidate = response.orders;
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (response.data && typeof response.data === 'object' && Array.isArray(response.data.orders)) {
      return response.data.orders;
    }
  }

  if (response && typeof response === 'object') {
    console.warn('Kitchen orders response did not contain an orders array', response);
  }

  return [];
}

function dedupeOrders(orders) {
  const seen = new Set();
  const result = [];

  for (const order of orders) {
    const key = order?.id ?? order?.orderNumber ?? order?.displayId;
    if (key != null && seen.has(String(key))) {
      continue;
    }
    if (key != null) {
      seen.add(String(key));
    }
    result.push(order);
  }

  return result;
}

function normalizeKitchenStatus(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isCompletedKitchenOrder(order) {
  const status = normalizeKitchenStatus(order?.status);
  return status === 'completed' || status === 'complete' || status === 'done' || status === 'finished';
}

async function loadCompletedOrdersFallback() {
  const attempts = ['completed', 'complete', undefined];

  for (const attempt of attempts) {
    const response = await fetchOrdersByStatus(attempt);
    const normalized = normalizeOrdersResponse(response);
    const completedOrders = normalized.filter((order) => isCompletedKitchenOrder(order) || order?.completedAt);
    if (completedOrders.length > 0) {
      return completedOrders;
    }
  }

  return [];
}

export function useKitchenOrders(status = 'new', refreshIntervalMs = 60000) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchOrdersByStatus(status);
      let normalizedOrders = normalizeOrdersResponse(response);

      if (status === 'completed' && normalizedOrders.length === 0) {
        normalizedOrders = await loadCompletedOrdersFallback();
      }

      setOrders(dedupeOrders(normalizedOrders));
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setOrders([]);
      setError(err.message || 'Unable to load orders');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const id = setInterval(() => {
      loadOrders();
    }, refreshIntervalMs);

    return () => {
      clearInterval(id);
    };
  }, [loadOrders, refreshIntervalMs]);

  return { orders, loading, error, refresh: loadOrders, lastUpdated };
}
