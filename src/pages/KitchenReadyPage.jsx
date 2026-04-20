import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KitchenHeader from '../components/kitchen/KitchenHeader.jsx';
import KitchenOrderCard from '../components/kitchen/KitchenOrderCard.jsx';
import { restaurantUserLogout } from '../api/authApi.js';
import { resolveKitchenOrderActionId, updateOrderStatus } from '../api/ordersApi.js';
import { useKitchenOrders } from '../hooks/useKitchenOrders.js';
import { clearKitchenAuthTokens, getKitchenRefreshToken } from '../services/authStorage.js';

function formatTimestamp(date) {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function KitchenReadyPage() {
  const navigate = useNavigate();
  const { orders, loading, error, refresh, lastUpdated } = useKitchenOrders('ready_for_pickup');
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleComplete = async (order) => {
    const actionOrderId = resolveKitchenOrderActionId(order);
    if (!actionOrderId) {
      setActionError('Unable to determine order id');
      return;
    }

    setActionError(null);
    setUpdatingId(actionOrderId);
    try {
      await updateOrderStatus(actionOrderId, 'completed');
      await refresh();
      navigate('/kitchen/orders', { replace: true, state: { activeStatus: 'completed' } });
    } catch (err) {
      setActionError(err.message || 'Unable to update order');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    const refreshToken = getKitchenRefreshToken();
    try {
      if (refreshToken) {
        await restaurantUserLogout(refreshToken);
      }
    } catch (error) {
      console.warn('Failed to notify server about kitchen logout', error);
    } finally {
      clearKitchenAuthTokens();
      navigate('/kitchen/login', { replace: true });
    }
  };

  let content = null;
  if (loading) {
    content = <div className="kitchen-empty-state">Loading ready-for-pickup orders…</div>;
  } else if (error) {
    content = <div className="kitchen-empty-state">{error}</div>;
  } else if (!orders?.length) {
    content = <div className="kitchen-empty-state">No ready-for-pickup orders</div>;
  } else {
    content = (
      <section className="kitchen-orders-grid">
        {orders.map((order) => (
          <KitchenOrderCard
            key={order.id}
            order={order}
            onAction={() => handleComplete(order)}
            actionLoading={updatingId === resolveKitchenOrderActionId(order)}
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
        onLogout={handleLogout}
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
