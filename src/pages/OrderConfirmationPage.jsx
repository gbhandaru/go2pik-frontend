import { useLocation, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatCurrency.js';

function formatPickupLabel(order) {
  if (!order) {
    return 'ASAP • Ready in 15–20 min';
  }

  const request = order.pickupRequest;

  if (request && typeof request === 'object') {
    if (request.summary) {
      return request.summary;
    }
    if (request.type === 'SCHEDULED' && request.scheduledTime) {
      return `Scheduled today at ${formatDisplayTime(request.scheduledTime)}`;
    }
    if (request.type === 'ASAP') {
      return 'ASAP • Ready in 15–20 min';
    }
  }

  if (typeof request === 'string' && request !== 'ASAP') {
    return request;
  }

  if (order.pickupTime) {
    const parsed = formatDisplayTime(order.pickupTime);
    if (parsed) {
      return parsed;
    }
  }

  return 'ASAP • Ready in 15–20 min';
}

function formatDisplayTime(value) {
  if (!value) {
    return '';
  }

  // Support both ISO strings and HH:mm values returned from the picker.
  if (value.includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  }

  const [hoursString, minutes] = value.split(':');
  if (hoursString === undefined || minutes === undefined) {
    return '';
  }
  const hours = Number(hoursString);
  if (Number.isNaN(hours)) {
    return '';
  }
  const period = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${normalizedHours}:${minutes} ${period}`;
}

function getConfirmationNumber(order) {
  if (!order) {
    return 'Order';
  }

  const directValue = order.orderNumber || order.confirmationNumber || order.referenceNumber || order.reference;
  if (directValue) {
    return directValue;
  }

  if (order.order?.orderNumber) {
    return order.order.orderNumber;
  }

  if (order.response?.orderNumber) {
    return order.response.orderNumber;
  }

  return order.id || 'Order';
}

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state?.order;

  if (!order) {
    return (
      <main className="page-section">
        <div className="page-empty-state">
          <h2>Order complete</h2>
          <p>We could not find the confirmation details, but your order was submitted.</p>
          <button type="button" className="primary-btn" onClick={() => navigate('/home')}>
            Back to restaurants
          </button>
        </div>
      </main>
    );
  }

  const items = order.items || [];
  const pickupLabel = formatPickupLabel(order);
  const restaurantName = order.restaurant?.name || 'your restaurant';
  const destination = order.restaurant?.location || order.restaurant?.address || '';
  const confirmationNumber = getConfirmationNumber(order);
  const subtotal = order.subtotal ?? order.total ?? items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const tax = order.tax ?? 0;
  const total = order.total ?? subtotal + tax;

  return (
    <main className="page-section" style={{ alignItems: 'center' }}>
      <section className="card center confirmation-card">
        <div className="check">✓</div>
        <h2>Order Confirmed! 🎉</h2>
        <p className="muted">Your pickup order is on its way to the kitchen.</p>
        <div className="summary-grid">
          <article className="summary-card">
            <p className="eyebrow">Pickup window</p>
            <strong>{pickupLabel}</strong>
            <p className="muted">{destination || 'Ready when you arrive'}</p>
          </article>
          <article className="summary-card">
            <p className="eyebrow">Confirmation</p>
            <strong>{confirmationNumber}</strong>
            <p className="muted">Show this at {restaurantName}</p>
          </article>
        </div>

        {items.length > 0 && (
          <div className="order-breakdown">
            <p className="eyebrow">What you ordered</p>
            <ul className="line-items compact">
              {items.map((item) => (
                <li key={item.id || item.sku || item.name}>
                  <span>
                    {item.quantity || 1} × {item.name}
                  </span>
                  <strong>{formatCurrency((item.price || 0) * (item.quantity || 1))}</strong>
                </li>
              ))}
            </ul>
            <div className="totals order-totals">
              <div>
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div>
                <span>Tax</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="grand">
                <strong>Total</strong>
                <strong>{formatCurrency(total)}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="actions">
          <button type="button" className="primary-btn" onClick={() => navigate('/home')}>
            Browse restaurants
          </button>
          <button type="button" className="primary-btn secondary" onClick={() => navigate('/orders')}>
            Track orders
          </button>
        </div>
      </section>
    </main>
  );
}
