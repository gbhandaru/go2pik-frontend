import { useCallback, useEffect, useState } from 'react';
import { fetchOrdersByStatus } from '../api/ordersApi.js';

export function useKitchenOrders(status = 'new') {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchOrdersByStatus(status);
      setOrders(response || []);
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
    }, 10000);

    return () => {
      clearInterval(id);
    };
  }, [loadOrders]);

  return { orders, loading, error, refresh: loadOrders, lastUpdated };
}
