import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
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

function getCustomerName(entity) {
  if (!entity) {
    return '';
  }

  const directFields = [
    entity.firstName,
    entity.first_name,
    entity.full_name,
    entity.fullName,
    entity.name,
    entity.customerName,
    entity.customer_name,
    entity.displayName,
  ];

  const directMatch = directFields.find((value) => typeof value === 'string' && value.trim());
  if (directMatch) {
    return directMatch.trim();
  }

  const composite =
    [entity.first_name || entity.firstName, entity.last_name || entity.lastName]
      .filter(Boolean)
      .join(' ');
  if (composite.trim()) {
    return composite.trim();
  }

  return (
    getCustomerName(entity.profile) ||
    getCustomerName(entity.user) ||
    getCustomerName(entity.customer) ||
    ''
  );
}

function resolveCustomerName({ user, order }) {
  return getCustomerName(user) || getCustomerName(order?.customer) || getCustomerName(order) || '';
}

function getBrowseMenuPath(order) {
  if (!order) {
    return '/home';
  }
  const restaurantId = order.restaurantId || order.restaurant?.id;
  return restaurantId ? `/restaurants/${restaurantId}/menu` : '/home';
}

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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
  const customerName = resolveCustomerName({ user, order });
  const subtotal =
    order.subtotal ??
    order.total ??
    items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const tax = order.tax ?? 0;
  const total = order.total ?? subtotal + tax;
  const browseMenuPath = getBrowseMenuPath(order);

  const heroSubhead = customerName
    ? (
        <>
          <strong>Thank you, {customerName}!</strong> Your order is being prepared.
        </>
      )
    : 'Thank you! Your order is being prepared.';

  const handleBrowseMenu = () => navigate(browseMenuPath);
  const handleBrowseRestaurants = () => navigate('/home');

  return (
    <main className="page-section confirmation-page">
      <section className="confirmation-shell">
        <div className="confirmation-icon" aria-hidden="true">
          ✓
        </div>
        <h1>
          Order Confirmed <span role="img" aria-label="celebration">🎉</span>
        </h1>
        <p className="confirmation-lede">{heroSubhead}</p>
        <p className="muted confirmation-subtext">We'll notify you when your order is ready for pickup.</p>

        <div className="confirmation-info-grid">
          <article className="confirmation-info-card">
            <p className="eyebrow">Pickup window</p>
            <strong>{pickupLabel}</strong>
            <p className="info-subtext">{destination || 'Ready when you arrive'}</p>
          </article>
          <article className="confirmation-info-card">
            <p className="eyebrow">Order #</p>
            <strong>{confirmationNumber}</strong>
            <p className="info-subtext with-icon">
              <LocationPinIcon /> Pickup location: {restaurantName}
            </p>
          </article>
        </div>

        <div className="order-summary-modern">
          <p className="eyebrow">What you ordered</p>
          {items.length > 0 ? (
            <ul className="order-items">
              {items.map((item) => (
                <li key={item.id || item.sku || item.name}>
                  <div>
                    <span>
                      {item.quantity || 1} × {item.name}
                    </span>
                  </div>
                  <strong>{formatCurrency((item.price || 0) * (item.quantity || 1))}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">This order's line items are not available right now.</p>
          )}

          <div className="order-totals">
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

        <div className="confirmation-actions">
          <button type="button" className="primary-btn" onClick={handleBrowseMenu}>
            <PlateIcon aria-hidden="true" className="btn-icon" />
            Browse menu
          </button>
          <button type="button" className="primary-btn secondary" onClick={handleBrowseRestaurants}>
            <StorefrontIcon aria-hidden="true" className="btn-icon" />
            Browse restaurants
          </button>
        </div>

        <p className="support-text">
          Need help?{' '}
          <a href="mailto:support@go2pik.com" className="text-link">
            Contact support
          </a>
        </p>
      </section>
    </main>
  );
}

function PlateIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8M12 7v5" />
    </svg>
  );
}

function StorefrontIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 9h18l-1 11H4L3 9Z" />
      <path d="M5 9V5h14v4" />
      <path d="M9 14h6v6H9z" />
    </svg>
  );
}

function LocationPinIcon(props) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M8 14s5-3.2 5-7A5 5 0 0 0 3 7c0 3.8 5 7 5 7Z" />
      <circle cx="8" cy="6.5" r="1.5" />
    </svg>
  );
}
