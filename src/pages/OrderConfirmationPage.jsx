import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { acceptUpdatedCustomerOrder, cancelCustomerOrder, fetchOrderById } from '../api/ordersApi.js';
import ContactSupportModal from '../components/shared/ContactSupportModal.jsx';
import CustomerPartialOrderModal from '../components/shared/CustomerPartialOrderModal.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatRestaurantAddress, getRestaurantAddressLines } from '../utils/formatRestaurantAddress.js';
import { getCustomerHomePath, getCustomerOrdersPath } from '../utils/customerFlow.js';
import { buildSupportMailtoHref } from '../utils/supportEmail.js';
import { getRestaurantMenuPath } from '../utils/restaurantRoutes.js';

function formatPickupLabel(order) {
  const request = order?.pickupRequest || {};
  const scheduledLabel =
    request.summary ||
    order?.pickupDisplayTime ||
    order?.customer?.pickupDisplayTime ||
    request.displayTime ||
    '';
  const asapLabel =
    request.displayTime ||
    order?.pickupDisplayTime ||
    order?.customer?.pickupDisplayTime ||
    '';

  if (request.type === 'SCHEDULED' && scheduledLabel) {
    return `Pickup around ${scheduledLabel}`;
  }
  if ((request.type === 'ASAP' || !request.type) && asapLabel) {
    return `Pickup around ${asapLabel}`;
  }
  if (scheduledLabel) {
    return `Pickup around ${scheduledLabel}`;
  }

  const readyTime = extractReadyTime(order);
  if (readyTime) {
    return `Pickup around ${readyTime}`;
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
  if (typeof request.displayTime === 'string' && request.displayTime.trim()) {
    return request.displayTime.trim();
  }
  if (typeof order?.pickupDisplayTime === 'string' && order.pickupDisplayTime.trim()) {
    return order.pickupDisplayTime.trim();
  }
  if (typeof request.summary === 'string' && request.summary.trim()) {
    return request.summary.trim();
  }
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
  return getRestaurantMenuPath(order?.restaurantRouteKey || order?.restaurant || order?.restaurantId);
}

function isPartialAcceptance(order) {
  if (!order) {
    return false;
  }

  const acceptanceMode = String(order.acceptanceMode || order.acceptance_mode || '').trim().toLowerCase();
  if (acceptanceMode === 'partial') {
    return true;
  }

  return Boolean(
    normalizeOrderItems(order?.acceptedItems || order?.accepted_items).length ||
      normalizeOrderItems(order?.unavailableItems || order?.unavailable_items).length,
  );
}

function isPendingPartialCustomerAction(order) {
  if (!isPartialAcceptance(order)) {
    return false;
  }

  const action = String(order?.customerAction || order?.customer_action || '').trim().toLowerCase();
  return !action || action === 'pending';
}

function getVisibleOrderItems(order) {
  const acceptedItems = normalizeOrderItems(order?.acceptedItems || order?.accepted_items);
  if (acceptedItems.length) {
    return acceptedItems;
  }

  return normalizeOrderItems(order?.items);
}

function resolveOrderSubtotal(order, items) {
  const direct = order?.subtotal ?? order?.updatedSubtotal ?? order?.updated_subtotal;
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return direct;
  }

  if (typeof direct === 'string' && direct.trim()) {
    const parsed = Number(direct);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return items.reduce((sum, item) => sum + getLineTotal(item), 0);
}

function resolveOrderDiscount(order, subtotal) {
  const direct = order?.discountAmount ?? order?.discountAmountDisplay;
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return Math.min(Math.max(direct, 0), subtotal);
  }
  if (typeof direct === 'string' && direct.trim()) {
    const parsed = Number(direct);
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 0), subtotal);
    }
  }

  const fallbackNumeric =
    order?.discount_amount ??
    order?.promoDiscount ??
    order?.promo_discount ??
    order?.promotionDiscount ??
    order?.promotion_discount;
  if (typeof fallbackNumeric === 'number' && Number.isFinite(fallbackNumeric)) {
    return Math.min(Math.max(fallbackNumeric, 0), subtotal);
  }
  if (typeof fallbackNumeric === 'string' && fallbackNumeric.trim()) {
    const parsed = Number(fallbackNumeric);
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 0), subtotal);
    }
  }

  const discountDisplay = order?.discountAmountDisplay;
  if (typeof discountDisplay === 'string' && discountDisplay.trim()) {
    const parsed = Number(discountDisplay);
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 0), subtotal);
    }
  }

  return 0;
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(Boolean).map((item, index) => ({
    ...item,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    __fallbackKey: item.menuItemId || item.id || item.name || `item-${index}`,
  }));
}

function getLineTotal(item) {
  const quantity = Number(item?.quantity) > 0 ? Number(item.quantity) : 1;
  const price = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0);
  return quantity * (Number.isFinite(price) ? price : 0);
}

function mergePromoMetaIntoOrder(order, promoMeta) {
  if (!order || typeof order !== 'object' || !promoMeta) {
    return order;
  }

  const mergedPromo = {
    ...(order.appliedPromo || {}),
    promoCode:
      order?.appliedPromo?.promoCode ||
      order?.appliedPromo?.code ||
      order?.promotionCode ||
      order?.promoCode ||
      promoMeta.promoCode ||
      promoMeta.code ||
      undefined,
    discountAmount: Number.isFinite(Number(order?.discountAmount ?? order?.discount_amount))
      ? Number(order.discountAmount ?? order.discount_amount)
      : Number(promoMeta.discountAmount ?? promoMeta.discount_amount ?? 0) || 0,
    finalAmount: Number.isFinite(Number(order?.finalAmount ?? order?.final_amount))
      ? Number(order.finalAmount ?? order.final_amount)
      : Number(promoMeta.finalAmount ?? promoMeta.final_amount ?? 0) || 0,
  };

  return {
    ...order,
    appliedPromo: mergedPromo,
    promotionCode: order.promotionCode ?? order.promoCode ?? mergedPromo.promoCode ?? undefined,
    promoCode: order.promoCode ?? order.promotionCode ?? mergedPromo.promoCode ?? undefined,
    discountAmount: order.discountAmount ?? order.discount_amount ?? mergedPromo.discountAmount,
    finalAmount: order.finalAmount ?? order.final_amount ?? mergedPromo.finalAmount,
    total: order.total ?? order.finalAmount ?? order.final_amount ?? mergedPromo.finalAmount,
  };
}

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const orderId = searchParams.get('orderId');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showPartialOrderModal, setShowPartialOrderModal] = useState(false);
  const [partialOrderSubmitting, setPartialOrderSubmitting] = useState(false);
  const [partialOrderError, setPartialOrderError] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setCurrentOrder(null);
      setShowPartialOrderModal(false);
      return;
    }

    let active = true;
    fetchOrderById(orderId)
      .then((response) => {
        if (!active) {
          return;
        }
        const latestOrder = response?.order || response?.data?.order || response;
        if (latestOrder && typeof latestOrder === 'object') {
          const mergedOrder = mergePromoMetaIntoOrder(latestOrder, location.state?.promoMeta);
          setCurrentOrder(mergedOrder);
          setShowPartialOrderModal(isPendingPartialCustomerAction(mergedOrder));
        } else {
          setCurrentOrder(null);
          setShowPartialOrderModal(false);
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setCurrentOrder(null);
        setShowPartialOrderModal(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const order = currentOrder;

  useEffect(() => {
    setShowPartialOrderModal(isPartialAcceptance(order));
  }, [order]);

  if (!order) {
    return (
      <main className="page-section">
        <div className="page-empty-state">
          <h2>Order complete</h2>
          <p>We could not find the confirmation details, but your order was submitted.</p>
          <button type="button" className="primary-btn" onClick={() => navigate(getCustomerHomePath())}>
            Back to restaurant list
          </button>
        </div>
      </main>
    );
  }

  const items = getVisibleOrderItems(order);
  const pickupLabel = formatPickupLabel(order);
  const restaurantName = order.restaurant?.name || 'your restaurant';
  const restaurantAddress = getRestaurantAddressLines(order.restaurant);
  const destination =
    formatRestaurantAddress(order.restaurant) ||
    order.restaurant?.location ||
    order.restaurant?.address ||
    '';
  const confirmationNumber = getConfirmationNumber(order);
  const resolvedCustomerName = resolveCustomerName({ user, order });
  const fallbackCustomerName = location.state?.customerName;
  const customerName = fallbackCustomerName || resolvedCustomerName;
  const subtotal = resolveOrderSubtotal(order, items);
  const discount = resolveOrderDiscount(order, subtotal);
  const browseMenuPath = getBrowseMenuPath(order);
  const supportEmail = 'orders@go2pik.com';
  const supportHref = buildSupportMailtoHref({
    email: supportEmail,
    subject: `Go2Pik support - Order ${confirmationNumber}`,
    body: `Hi Go2Pik team,\n\nI need help with order #${confirmationNumber}.`,
  });

  async function handleCopySupportEmail() {
    try {
      await navigator.clipboard.writeText(supportEmail);
    } catch {
      const tempInput = document.createElement('input');
      tempInput.value = supportEmail;
      tempInput.setAttribute('readonly', 'true');
      tempInput.style.position = 'absolute';
      tempInput.style.left = '-9999px';
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    }
  }

  const heroSubtitle = customerName
    ? `Thank you, ${customerName}! Your order is being prepared.`
    : 'Thank you! Your order is being prepared.';

  const handleBrowseMenu = () => navigate(browseMenuPath);
  const handleBrowseRestaurants = () => navigate(getCustomerHomePath());
  const handleAcceptUpdatedOrder = async () => {
    if (!order?.id || partialOrderSubmitting) {
      return;
    }

    setPartialOrderSubmitting(true);
    try {
      const response = await acceptUpdatedCustomerOrder(order.id);
      const updatedOrder = response?.order || response?.data?.order || response || order;
      setCurrentOrder(updatedOrder);
      setShowPartialOrderModal(false);
      setPartialOrderError('');
    } catch (error) {
      setPartialOrderError(error?.message || 'Unable to accept the updated order right now.');
    } finally {
      setPartialOrderSubmitting(false);
    }
  };

  const handleCancelUpdatedOrder = async () => {
    if (!order?.id || partialOrderSubmitting) {
      return;
    }

    setPartialOrderSubmitting(true);
    try {
      const response = await cancelCustomerOrder(order.id, 'Please cancel the order');
      const updatedOrder = response?.order || response?.data?.order || response || order;
      setCurrentOrder(updatedOrder);
      setShowPartialOrderModal(false);
      setPartialOrderError('');
      navigate(getCustomerOrdersPath(), { replace: true });
    } catch (error) {
      setPartialOrderError(error?.message || 'Unable to cancel the updated order right now.');
    } finally {
      setPartialOrderSubmitting(false);
    }
  };

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
              {destination ? (
                <div className="info-subtext confirmation-address">
                  {restaurantAddress.line1 ? <span>{restaurantAddress.line1}</span> : null}
                  {restaurantAddress.secondary ? <span>{restaurantAddress.secondary}</span> : null}
                  {!restaurantAddress.line1 && !restaurantAddress.secondary ? <span>{destination}</span> : null}
                </div>
              ) : (
                <p className="info-subtext">Ready when you arrive</p>
              )}
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
              {discount > 0 ? (
                <div className="order-totals-discount">
                  <strong>Promo</strong>
                  <strong>-{formatCurrency(discount)}</strong>
                </div>
              ) : null}
              <div className="order-totals-grand-label">
                <strong>Estimated Total</strong>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
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
          <button type="button" className="text-link" onClick={() => setShowContactModal(true)}>
            Contact support
          </button>
        </p>
      </section>
      {showContactModal ? (
        <ContactSupportModal
          email={supportEmail}
          mailtoHref={supportHref}
          title="Need help with your order?"
          description="Use the email below for pickup, billing, or order questions."
          onClose={() => setShowContactModal(false)}
          onCopyEmail={handleCopySupportEmail}
        />
      ) : null}
      {showPartialOrderModal && isPendingPartialCustomerAction(order) ? (
        <CustomerPartialOrderModal
          order={order}
          onAcceptUpdatedOrder={handleAcceptUpdatedOrder}
          onCancelOrder={handleCancelUpdatedOrder}
          submitting={partialOrderSubmitting}
          error={partialOrderError}
        />
      ) : null}
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
