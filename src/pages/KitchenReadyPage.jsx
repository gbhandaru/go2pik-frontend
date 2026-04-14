import { useState } from 'react';
import KitchenHeader from '../components/kitchen/KitchenHeader.jsx';
import KitchenOrderCard from '../components/kitchen/KitchenOrderCard.jsx';
import { updateOrderStatus } from '../api/ordersApi.js';
import { useKitchenOrders } from '../hooks/useKitchenOrders.js';

function formatTimestamp(date) {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function KitchenReadyPage() {
  const { orders, loading, error, refresh, lastUpdated } = useKitchenOrders('ready');
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleComplete = async (order) => {
    setActionError(null);
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(order.id, 'completed');
      await refresh();
    } catch (err) {
      setActionError(err.message || 'Unable to update order');
    } finally {
      setUpdatingId(null);
    }
  };

  let content = null;
  if (loading) {
    content = <div className="kitchen-empty-state">Loading ready orders…</div>;
  } else if (error) {
    content = <div className="kitchen-empty-state">{error}</div>;
  } else if (!orders?.length) {
    content = <div className="kitchen-empty-state">No ready orders</div>;
  } else {
    content = (
      <section className="kitchen-orders-grid">
        {orders.map((order) => (
          <KitchenOrderCard
            key={order.id}
            order={order}
            onAction={() => handleComplete(order)}
            actionLoading={updatingId === order.id}
          />
        ))}
      </section>
    );
  }

  return (
    <main className="page-section kitchen-page">
      <KitchenHeader
        restaurantName="Go2Pik Kitchen"
        title="Ready for Pickup"
        subtitle="Bagged orders that just need a final scan."
      >
        <span className="muted">Last update: {formatTimestamp(lastUpdated)}</span>
        <button type="button" className="primary-btn secondary" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </KitchenHeader>

      {actionError && <p style={{ color: '#dc2626', fontWeight: 600 }}>{actionError}</p>}

      {content}
    </main>
  );
}
