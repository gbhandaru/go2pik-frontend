import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatCurrency } from '../utils/formatCurrency.js';

function formatPickupLabel(order) {
  const readyTime = extractReadyTime(order);
  if (readyTime) {
    return `Ready by ${readyTime}`;
  }
  return 'Ready soon';
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

function extractReadyTime(order) {
  if (!order) {
    return '';
  }
  const request = order.pickupRequest || {};
  if (request.type === 'SCHEDULED' && request.scheduledTime) {
    return formatDisplayTime(request.scheduledTime);
  }
  if (order.pickupTime) {
    const parsed = formatDisplayTime(order.pickupTime);
    if (parsed) {
      return parsed;
    }
  }
  if (typeof request.readyTime === 'string') {
    const parsed = formatDisplayTime(request.readyTime);
    if (parsed) {
      return parsed;
    }
  }
  const summaryMatch =
    typeof request.summary === 'string'
      ? request.summary.match(/(~?\s*\d{1,2}:\d{2}\s?(?:AM|PM))/i)
      : null;
  if (summaryMatch) {
    return summaryMatch[0].trim();
  }
  return '';
}

function getConfirmationNumber(order) {
  if (!order) {
    return 'Order';
  }

  const directValue =
    order.orderNumber ||
    order.confirmationNumber ||
    order.referenceNumber ||
    order.reference ||
    order.automation?.confirmationNumber;
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
    entity.customerName,
    entity.customer_name,
    entity.firstName,
    entity.first_name,
    entity.givenName,
    entity.given_name,
    entity.middleName,
    entity.middle_name,
    entity.lastName,
    entity.last_name,
    entity.preferredName,
    entity.preferred_name,
    entity.full_name,
    entity.fullName,
    entity.name,
    entity.displayName,
    entity.display_name,
    entity.nickname,
    entity.userName,
    entity.user_name,
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

  const nestedFields = [entity.profile, entity.user, entity.customer, entity.details, entity.data, entity.attributes, entity.result];
  for (const nested of nestedFields) {
    const nestedMatch = getCustomerName(nested);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return (
    getCustomerName(entity.profile) ||
    getCustomerName(entity.user) ||
    getCustomerName(entity.customer) ||
    ''
  );
}

function resolveCustomerName({ user, order }) {
  const userMatch = getCustomerName(user);
  if (userMatch) {
    return userMatch;
  }
  const orderEntities = [
    order?.customerName,
    order?.customer_name,
    order?.customer?.name,
    order?.order?.customer?.name,
    order?.order?.customerName,
    order?.order?.customer_name,
    order?.customer,
    order?.customerDetails,
    order?.customer_details,
    order?.customerInfo,
    order?.customer_info,
    order?.profile,
    order?.user,
    order?.data,
    order?.attributes,
    order?.result,
  ];
  for (const entry of orderEntities) {
    const match = getCustomerName(entry);
    if (match) {
      return match;
    }
  }
  return getCustomerName(order) || '';
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
            Back to restaurant list
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
  const resolvedCustomerName = resolveCustomerName({ user, order });
  const fallbackCustomerName = location.state?.customerName;
  const customerName = fallbackCustomerName || resolvedCustomerName;
  const subtotal =
    order.subtotal ??
    order.total ??
    items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const total = order.total ?? subtotal;
  const browseMenuPath = getBrowseMenuPath(order);

  const heroSubtitle = customerName
    ? `Thank you, ${customerName}! Your order is being prepared.`
    : 'Thank you! Your order is being prepared.';

  const handleBrowseMenu = () => navigate(browseMenuPath);
  const handleBrowseRestaurants = () => navigate('/home');

  return (
    <main className="page-section confirmation-page">
      <section className="confirmation-shell">
        <header className="confirmation-hero">
          <div className="confirmation-icon" aria-hidden="true">
            ✓
          </div>
          <div className="confirmation-hero-copy">
            <h1>
              Order Confirmed <span role="img" aria-label="celebration">🎉</span>
            </h1>
            <p className="confirmation-lede">{heroSubtitle}</p>
            <p className="muted confirmation-subtext">We'll notify you when your order is ready for pickup.</p>
          </div>
        </header>

        <section className="pickup-info-card" aria-label="Pickup information">
          <div className="pickup-info-row">
            <div>
              <p className="eyebrow">Pickup time</p>
              <strong>{pickupLabel}</strong>
            </div>
            <div>
              <p className="eyebrow">Location</p>
              <strong>{restaurantName}</strong>
              <p className="info-subtext">{destination || 'Ready when you arrive'}</p>
            </div>
          </div>
          <p className="pickup-info-helper">
            <strong>Order #{confirmationNumber}</strong>
            <span>Show this at pickup counter</span>
          </p>
        </section>

        <div className="order-summary-modern">
          <p className="eyebrow">What you ordered</p>
          {items.length > 0 ? (
            <ul className="order-items">
              {items.map((item) => {
                const itemInstructions = getItemInstructions(item);
                return (
                  <li key={item.id || item.sku || item.name}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity || 1} × {formatCurrency(item.price || 0)}
                      </span>
                      {itemInstructions ? (
                        <span className="order-item-instructions">{itemInstructions}</span>
                      ) : null}
                    </div>
                    <strong>{formatCurrency((item.price || 0) * (item.quantity || 1))}</strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">This order's line items are not available right now.</p>
          )}

          <div className="order-totals">
            <div className="grand">
              <div className="order-totals-grand-label">
                <strong>Estimated total</strong>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <small className="order-totals-footnote">* Taxes will be calculated at the time of payment</small>
            </div>
          </div>
        </div>

        <div className="confirmation-actions">
          <button type="button" className="primary-btn emphasis" onClick={handleBrowseMenu}>
            <PlateIcon aria-hidden="true" className="btn-icon" />
            Browse Menu
          </button>
          <button type="button" className="primary-btn secondary" onClick={handleBrowseRestaurants}>
            <StorefrontIcon aria-hidden="true" className="btn-icon" />
            Browse Restaurants
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

function getItemInstructions(item) {
  if (!item) {
    return '';
  }

  return (
    item.specialInstructions ||
    item.special_instructions ||
    item.instructions ||
    item.note ||
    ''
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
