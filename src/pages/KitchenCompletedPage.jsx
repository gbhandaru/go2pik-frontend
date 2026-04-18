import { useNavigate } from 'react-router-dom';
import KitchenHeader from '../components/kitchen/KitchenHeader.jsx';
import KitchenOrderCard from '../components/kitchen/KitchenOrderCard.jsx';
import { restaurantUserLogout } from '../api/authApi.js';
import { useKitchenOrders } from '../hooks/useKitchenOrders.js';
import { clearKitchenAuthTokens, getKitchenRefreshToken } from '../services/authStorage.js';

function formatTimestamp(date) {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function KitchenCompletedPage() {
  const navigate = useNavigate();
  const { orders, loading, error, refresh, lastUpdated } = useKitchenOrders('completed');

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
    content = <div className="kitchen-empty-state">Loading completed orders…</div>;
  } else if (error) {
    content = <div className="kitchen-empty-state">{error}</div>;
  } else if (!orders?.length) {
    content = <div className="kitchen-empty-state">No completed orders yet</div>;
  } else {
    content = (
      <section className="kitchen-orders-grid">
        {orders.map((order) => (
          <KitchenOrderCard key={order.id} order={order} />
        ))}
      </section>
    );
  }

  return (
    <main className="page-section kitchen-page">
      <KitchenHeader
        restaurantName="Go2Pik Kitchen"
        title="Completed Pickups"
        subtitle="Quick reference for the last few handoffs."
        onLogout={handleLogout}
      >
        <span className="muted">Last update: {formatTimestamp(lastUpdated)}</span>
        <button type="button" className="primary-btn secondary" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </KitchenHeader>

      {content}
    </main>
  );
}
