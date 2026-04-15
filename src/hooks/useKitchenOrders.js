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

export function useKitchenOrders(status = 'new') {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshIntervalMs = 60000;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchOrdersByStatus(status);
      setOrders(normalizeOrdersResponse(response));
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
