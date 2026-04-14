import { useState } from 'react';
import KitchenHeader from '../components/kitchen/KitchenHeader.jsx';
import KitchenOrderCard from '../components/kitchen/KitchenOrderCard.jsx';
import KitchenTabs from '../components/kitchen/KitchenTabs.jsx';
import { updateOrderStatus } from '../api/ordersApi.js';
import { useKitchenOrders } from '../hooks/useKitchenOrders.js';

const STATUS_FLOW = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

const TAB_CONFIG = [
  { value: 'new', label: 'New' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
];

const TAB_SUBTITLE = {
  new: 'Review incoming pickup tickets and accept them quickly.',
  preparing: 'Track orders on the line and mark them ready when bagged.',
  ready: 'Stage completed bags and mark pickups when guests arrive.',
  completed: 'Reference pickups completed recently for quick lookups.',
};

const EMPTY_MESSAGES = {
  new: 'No new orders',
  preparing: 'No orders in preparation',
  ready: 'No ready orders',
  completed: 'No completed orders yet',
};

function formatTimestamp(date) {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function KitchenOrdersPage() {
  const [activeStatus, setActiveStatus] = useState('new');
  const { orders, loading, error, refresh, lastUpdated } = useKitchenOrders(activeStatus);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const headerSubtitle = TAB_SUBTITLE[activeStatus];

  const handleTabChange = (status) => {
    setActionError(null);
    setActiveStatus(status);
  };

  const handleAdvance = async (order) => {
    const nextStatus = STATUS_FLOW[order.status];
    if (!nextStatus) return;
    setActionError(null);
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(order.id, nextStatus);
      await refresh();
    } catch (err) {
      setActionError(err.message || 'Unable to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  let ordersContent = null;
  if (loading) {
    ordersContent = <div className="kitchen-empty-state">Loading orders…</div>;
  } else if (error) {
    ordersContent = <div className="kitchen-empty-state">{error}</div>;
  } else if (!orders?.length) {
    ordersContent = <div className="kitchen-empty-state">{EMPTY_MESSAGES[activeStatus]}</div>;
  } else {
    ordersContent = (
      <section className="kitchen-orders-grid">
        {orders.map((order) => (
          <KitchenOrderCard
            key={order.id}
            order={order}
            onAction={STATUS_FLOW[order.status] ? () => handleAdvance(order) : undefined}
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
        title="Kitchen Dashboard"
        subtitle={headerSubtitle}
      >
        <span className="muted">Last update: {formatTimestamp(lastUpdated)}</span>
        <button type="button" className="primary-btn secondary" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </KitchenHeader>

      <KitchenTabs tabs={TAB_CONFIG} activeTab={activeStatus} onTabChange={handleTabChange} />

      {actionError && <p style={{ color: '#dc2626', fontWeight: 600 }}>{actionError}</p>}

      {ordersContent}
    </main>
  );
}
