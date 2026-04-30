import { formatCurrency } from '../../utils/formatCurrency.js';
import { getOrderStatusLabel } from '../../utils/orderStatus.js';

function actionClassName(variant) {
  if (variant === 'emphasis') {
    return 'primary-btn emphasis kitchen-action-btn--accept';
  }

  if (variant === 'danger') {
    return 'primary-btn kitchen-action-btn--reject';
  }

  if (variant === 'warning') {
    return 'primary-btn kitchen-action-btn--partial';
  }

  if (variant === 'quiet') {
    return 'primary-btn ghost';
  }

  if (variant === 'secondary') {
    return 'primary-btn secondary';
  }

  return 'primary-btn';
}

export default function KitchenOrderCard({
  order,
  onAction,
  actionLoading = false,
  actions = [],
  loadingActionStatus = null,
  ageMinutes,
  compact = false,
}) {
  if (!order) return null;

  const orderNumber = order.orderNumber || order.displayId || order.id;
  const customerName = order.customerName || order.customer?.name || 'Guest';
  const visibleItems = getVisibleOrderItems(order);
  const totalItems =
    typeof order.totalItems === 'number'
      ? order.totalItems
      : visibleItems.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
  const statusLabel = getOrderStatusLabel(order.status);
  const pickupTime = order.pickupTime || order.pickupAt || order.scheduledPickupTime || null;
  const totalValue = resolvePayableAmountDisplay(order);
  const hasTotal = totalValue != null;
  const hasMultipleActions = actions.length > 1;
  const waitingMinutes = Number.isFinite(ageMinutes) ? Math.max(0, Math.round(ageMinutes)) : null;
  const isDelayed = waitingMinutes != null && waitingMinutes > 5;
  const waitLabel = waitingMinutes != null ? `Waiting ${waitingMinutes}m` : null;
  const acceptanceMode = String(order.acceptanceMode || order.acceptance_mode || '').toLowerCase();
  const customerAction = String(order.customerAction || order.customer_action || '').trim().toLowerCase();
  const isPartialAcceptance = acceptanceMode === 'partial' && (!customerAction || customerAction === 'pending');
  const unavailableCount = Array.isArray(order.unavailableItems)
    ? order.unavailableItems.reduce((sum, item) => sum + (item.quantity || 1), 0)
    : 0;

  return (
    <article
        className={[
        'kitchen-order-card',
        'card',
        compact ? 'kitchen-order-card--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="kitchen-order-card__meta">
        <div className="kitchen-order-card__order-heading">
          <div className="kitchen-order-card__order-title-row">
            <p className="kitchen-order-card__order-number">Order #{orderNumber}</p>
          </div>
          <div className="kitchen-order-card__badges">
            {waitLabel && (
              <span
                className={[
                  'kitchen-order-card__badge',
                  'kitchen-order-card__badge--age',
                  isDelayed ? 'kitchen-order-card__badge--late' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {waitLabel}
              </span>
            )}
          </div>
        </div>
        <div className="kitchen-order-card__pickup">
          {pickupTime && (
            <div className="kitchen-order-card__pickup-line">
              <span className="kitchen-order-card__pickup-label">PICKUP AT:</span>
              <strong>{pickupTime}</strong>
            </div>
          )}
          <div className="kitchen-order-card__pickup-line">
            <span className="kitchen-order-card__pickup-label">PICKUP FOR:</span>
            <strong>{customerName}</strong>
          </div>
          {isPartialAcceptance ? (
            <div className="kitchen-order-card__pickup-line kitchen-order-card__pickup-line--partial">
              <span className="kitchen-order-card__pickup-label">PARTIAL:</span>
              <strong>{unavailableCount > 0 ? `${unavailableCount} item${unavailableCount === 1 ? '' : 's'} unavailable` : 'Accepted items updated'}</strong>
            </div>
          ) : null}
        </div>
      </div>

      <div className="kitchen-order-card__items">
        <ul>
          {visibleItems?.length ? (
            visibleItems.map((item) => {
              const itemInstructions = getItemInstructions(item);
              return (
                <li key={`${order.id}-${item.id || item.name}`}>
                  <span className="kitchen-order-card__item-qty">{item.quantity || 1}×</span>
                  <div className="kitchen-order-card__item-copy">
                    <span className="kitchen-order-card__item-name">{item.name}</span>
                    {itemInstructions ? (
                      <span className="kitchen-order-card__item-note">{itemInstructions}</span>
                    ) : null}
                  </div>
                </li>
              );
            })
          ) : (
            <li className="muted">No items listed</li>
          )}
        </ul>
      </div>

      <footer className="kitchen-order-card__footer">
        <div className="kitchen-order-card__totals">
          <div>
            <p className="muted">Items:</p>
            <strong>{totalItems}</strong>
          </div>
          {hasTotal && (
            <div className="kitchen-order-card__totals-grand">
              <p className="muted">Estimated total:</p>
              <strong>{totalValue}</strong>
            </div>
          )}
        </div>
        {actions.length > 0 ? (
          <div
            className={[
              'kitchen-order-card__actions',
              hasMultipleActions ? 'kitchen-order-card__actions--multi' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {actions.map((action) => {
              const isLoading = loadingActionStatus === action.status;
              return (
                <button
                  key={action.status}
                  type="button"
                  className={actionClassName(action.variant)}
                  onClick={action.onClick}
                  disabled={actionLoading || isLoading || !action.onClick}
                >
                  {isLoading ? 'Updating…' : action.label}
                </button>
              );
            })}
          </div>
        ) : onAction ? (
          <button
            type="button"
            className="primary-btn"
            onClick={onAction}
            disabled={actionLoading || !onAction}
          >
            {actionLoading ? 'Updating…' : statusLabel}
          </button>
        ) : (
          <span className="kitchen-order-card__status">{statusLabel}</span>
        )}
      </footer>
    </article>
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

function getVisibleOrderItems(order) {
  const acceptedItems = normalizeOrderItems(order?.acceptedItems);
  if (acceptedItems.length) {
    return acceptedItems;
  }

  const fallbackItems = normalizeOrderItems(order?.items);
  if (fallbackItems.length) {
    return fallbackItems;
  }

  return [];
}

function resolvePayableAmountDisplay(order) {
  if (!order || typeof order !== 'object') {
    return null;
  }

  const displayCandidates = [
    order.payableAmountDisplay,
    order.estimatedTotalDisplay,
    order.finalAmountDisplay,
  ];
  for (const candidate of displayCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const numericCandidates = [order.payableAmount, order.finalAmount];
  for (const candidate of numericCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return formatCurrency(candidate);
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return formatCurrency(parsed);
      }
    }
  }

  return null;
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => ({
      ...item,
      id: item?.id ?? item?.menuItemId ?? item?.menu_item_id ?? item?.sku ?? `item-${index}`,
      name: item?.name || item?.title || item?.label || 'Item',
      quantity: Number(item?.quantity || 1),
      price: Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0),
      specialInstructions: item?.specialInstructions || item?.special_instructions || item?.instructions || item?.note || '',
    }))
    .filter((item) => item.id != null && item.name);
}
