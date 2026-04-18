import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCustomerOrders } from '../api/customersApi.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getCustomerDisplayName, getCustomerId } from '../utils/customerIdentity.js';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const customerId = useMemo(() => getCustomerId(user), [user]);
  const customerName = useMemo(() => getCustomerDisplayName(user), [user]);
  const { data, loading, error } = useFetch(
    () => (customerId ? fetchCustomerOrders(customerId) : Promise.resolve({ customer: null, orders: [] })),
    [customerId],
  );

  const customer = data?.customer || user || null;
  const orders = useMemo(() => sortOrdersByDate(data?.orders || []), [data?.orders]);
  const resolvedCustomerName = getCustomerDisplayName(customer) || customerName || 'Customer';
  const resolvedPhone = customer?.phone || customer?.phone_number || user?.phone || user?.phone_number || '';
  const resolvedEmail = customer?.email || user?.email || '';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleReorder = (order) => {
    const restaurantId = order?.restaurant?.id;
    if (!restaurantId) {
      return;
    }
    navigate(`/restaurants/${restaurantId}/menu`);
  };

  if (loading) {
    return (
      <main className="page-section customer-orders-page">
        <div className="page-empty-state">Loading your orders...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-section customer-orders-page">
        <div className="page-empty-state">{error}</div>
      </main>
    );
  }

  return (
    <main className="page-section customer-orders-page">
      <section className="customer-orders-shell">
        <aside className="customer-orders-sidebar card">
          <div className="customer-orders-profile">
            <div className="customer-orders-avatar">{resolvedCustomerName.charAt(0).toUpperCase() || 'G'}</div>
            <strong>{resolvedCustomerName}</strong>
            {resolvedPhone ? <span>{resolvedPhone}</span> : null}
            {resolvedEmail ? <span>{resolvedEmail}</span> : null}
          </div>

          <nav className="customer-orders-nav" aria-label="Customer sections">
            <button type="button" className="customer-orders-nav__item active">
              <span className="customer-orders-nav__icon" aria-hidden="true">
                <OrdersIcon />
              </span>
              My Orders
            </button>
            <button type="button" className="customer-orders-nav__item" onClick={() => navigate('/home')}>
              <span className="customer-orders-nav__icon" aria-hidden="true">
                <RestaurantIcon />
              </span>
              Restaurants
            </button>
            <button type="button" className="customer-orders-nav__item customer-orders-nav__item--logout" onClick={handleLogout}>
              <span className="customer-orders-nav__icon" aria-hidden="true">
                <LogoutIcon />
              </span>
              Logout
            </button>
          </nav>
        </aside>

        <section className="customer-orders-main">
          <header className="customer-orders-topbar card">
            <button type="button" className="customer-orders-back" onClick={() => navigate('/home')}>
              <span aria-hidden="true">←</span>
              <span>Back to Menu</span>
            </button>
            <div className="customer-orders-topbar__title" aria-hidden="true" />
            <div className="customer-orders-topbar__actions">
              <div className="customer-orders-topbar__chip" aria-hidden="true">
                <span>🔍</span>
              </div>
              <div className="customer-orders-topbar__chip" aria-hidden="true">
                <span>◌</span>
              </div>
              <div className="customer-orders-topbar__profile" aria-hidden="true">
                {resolvedCustomerName.charAt(0).toUpperCase() || 'G'}
              </div>
            </div>
          </header>

          <section className="customer-orders-list">
            <div className="customer-orders-heading">
              <h2>My Orders</h2>
              <span>{orders.length} order{orders.length === 1 ? '' : 's'}</span>
            </div>

            {orders.length === 0 ? (
              <div className="card customer-orders-empty">
                <p>No orders yet.</p>
              </div>
            ) : (
              orders.map((order) => {
                const statusLabel = formatOrderStatusLabel(order.status);
                return (
                  <article className="card customer-order-card" key={order.id}>
                    <div className="customer-order-card__main">
                      <div className="customer-order-card__header">
                        <div>
                          <h3>{order.restaurant?.name || 'Unknown restaurant'}</h3>
                          <p>{formatOrderPlacement(order)}</p>
                        </div>
                        <span className={`customer-order-card__status customer-order-card__status--${getOrderBucket(order)}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="customer-order-card__items">
                        {renderOrderItems(order.items)}
                      </div>

                      <div className="customer-order-card__meta">
                        <div>
                          <span>Order #</span>
                          <strong>{order.orderNumber || order.id}</strong>
                        </div>
                        <div>
                          <span>Payment</span>
                          <strong>{formatPaymentLabel(order)}</strong>
                        </div>
                        <div>
                          <span>Total</span>
                          <strong>{formatOrderTotal(order)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="customer-order-card__actions">
                      <button type="button" className="primary-btn secondary customer-order-card__button" onClick={() => handleReorder(order)}>
                        Reorder
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function sortOrdersByDate(orders = []) {
  return [...orders].sort((a, b) => {
    const aTime = getOrderTimeValue(a);
    const bTime = getOrderTimeValue(b);
    return bTime - aTime;
  });
}

function getOrderTimeValue(order) {
  const raw = order?.created_at || order?.createdAt || order?.placedAt || order?.customer?.pickupTime || order?.pickupTime || 0;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function renderOrderItems(items = []) {
  if (!items.length) {
    return <p className="muted customer-order-card__empty-items">No item details available.</p>;
  }

  const preview = items.slice(0, 3);
  return (
    <ul className="customer-order-items">
      {preview.map((item) => (
        <li key={item.menuItemId || item.id || item.name}>
          <span>{item.name}</span>
          <span>× {item.quantity || 1}</span>
        </li>
      ))}
      {items.length > 3 ? <li className="customer-order-items__more">+{items.length - 3} more</li> : null}
    </ul>
  );
}

function getOrderBucket(order) {
  const status = String(order?.status || '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'canceled' || status === 'rejected') {
    return 'cancelled';
  }
  return 'past';
}

function formatOrderPlacement(order) {
  const pickup =
    order?.customer?.pickupTime ||
    order?.pickupTime ||
    order?.pickupRequest?.scheduledTime ||
    order?.pickupRequest?.readyTime ||
    order?.placedAt ||
    order?.createdAt ||
    order?.created_at ||
    '';

  const date = pickup ? new Date(pickup) : null;
  if (date && !Number.isNaN(date.getTime())) {
    return `Picked up on ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} ${date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  return `Order ${order?.orderNumber || order?.id || ''}`.trim();
}

function formatOrderTotal(order) {
  if (order?.totalDisplay) {
    return order.totalDisplay;
  }
  return formatCurrency(order?.total || 0);
}

function formatPaymentLabel(order) {
  const mode = String(order?.paymentMode || '').replace(/_/g, ' ').trim();
  const status = String(order?.paymentStatus || '').replace(/_/g, ' ').trim();
  if (mode && status) {
    return `${capitalizeWords(mode)} • ${capitalizeWords(status)}`;
  }
  if (mode) {
    return capitalizeWords(mode);
  }
  if (status) {
    return capitalizeWords(status);
  }
  return 'Unavailable';
}

function formatOrderStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'rejected') {
    return 'Cancelled';
  }
  return 'Completed';
}

function capitalizeWords(value) {
  return String(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16v16H4z" fill="none" />
      <path d="M7 7h10M7 11h10M7 15h6" />
    </svg>
  );
}

function RestaurantIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10 12 4l8 6v10H4Z" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17v-2h4V9h-4V7l-5 5 5 5Zm9-13H12V2h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-7v-2h7V4Z" />
    </svg>
  );
}
