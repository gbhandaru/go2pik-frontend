import { fetchOrders } from '../api/ordersApi.js';
import { useFetch } from '../hooks/useFetch.js';
import { formatCurrency } from '../utils/formatCurrency.js';

export default function OrdersPage() {
  const { data: orders, loading, error } = useFetch(fetchOrders, []);

  return (
    <main className="page-section">
      <header className="page-header">
        <p>Track your meals</p>
        <h1>Orders</h1>
      </header>

      {loading && <div className="page-empty-state">Loading your orders...</div>}
      {error && <div className="page-empty-state">{error}</div>}

      {!loading && !error && (!orders || orders.length === 0) && (
        <div className="page-empty-state">No orders yet. Start shopping!</div>
      )}

      {!loading && !error && orders?.length > 0 && (
        <section className="card-grid">
          {orders.map((order) => {
            const placedAt = order.placedAt ? new Date(order.placedAt) : null;
            return (
              <article className="card" key={order.id}>
                <h2>{order.restaurant?.name || 'Unknown restaurant'}</h2>
                <p>Status: {order.status || 'pending'}</p>
                <p>Total: {formatCurrency(order.total)}</p>
                {placedAt && (
                  <p>
                    Placed on {placedAt.toLocaleDateString()} at{' '}
                    {placedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
