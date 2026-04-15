import { formatCurrency } from '../../utils/formatCurrency.js';

const STATUS_LABELS = {
  new: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  rejected: 'Rejected',
};

function actionClassName(variant) {
  if (variant === 'emphasis') {
    return 'primary-btn emphasis kitchen-action-btn--accept';
  }

  if (variant === 'danger') {
    return 'primary-btn kitchen-action-btn--reject';
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
  priorityLabel,
  compact = false,
}) {
  if (!order) return null;

  const orderNumber = order.orderNumber || order.displayId || order.id;
  const customerName = order.customerName || order.customer?.name || 'Guest';
  const isPending = order.status === 'new';
  const totalItems =
    typeof order.totalItems === 'number'
      ? order.totalItems
      : order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const totalValue = order.total ?? order.totalDisplay;
  const subtotalValue = order.subtotal ?? order.subtotalDisplay;
  const taxValue = order.tax ?? order.taxDisplay;
  const hasTotal = totalValue != null;
  const hasMultipleActions = actions.length > 1;
  const waitingMinutes = Number.isFinite(ageMinutes) ? Math.max(0, Math.round(ageMinutes)) : null;
  const isDelayed = waitingMinutes != null && waitingMinutes > 5;
  const waitLabel = waitingMinutes != null ? `Waiting ${waitingMinutes}m` : null;

  return (
    <article
      className={[
        'kitchen-order-card',
        'card',
        isPending ? 'kitchen-order-card--pending' : '',
        compact ? 'kitchen-order-card--compact' : '',
        priorityLabel ? 'kitchen-order-card--priority' : '',
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
            {isPending && <span className="kitchen-order-card__badge">Pending</span>}
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
            {priorityLabel && (
              <span className="kitchen-order-card__badge kitchen-order-card__badge--priority">
                {priorityLabel}
              </span>
            )}
          </div>
        </div>
        <div className="kitchen-order-card__pickup">
          <span className="kitchen-order-card__pickup-label">PICKUP FOR:</span>
          <strong>{customerName}</strong>
        </div>
      </div>

      <div className="kitchen-order-card__items">
        <ul>
          {order.items?.length ? (
            order.items.map((item) => (
              <li key={`${order.id}-${item.id || item.name}`}>
                <span className="kitchen-order-card__item-qty">{item.quantity || 1}×</span>
                <span className="kitchen-order-card__item-name">{item.name}</span>
              </li>
            ))
          ) : (
            <li className="muted">No items listed</li>
          )}
        </ul>
      </div>

      <footer className="kitchen-order-card__footer">
        <div className="kitchen-order-card__totals">
          <div>
            <p className="muted">Total items</p>
            <strong>{totalItems}</strong>
          </div>
          {hasTotal && (
            <div>
              <p className="muted">Order total</p>
              <strong>{typeof totalValue === 'number' ? formatCurrency(totalValue) : totalValue}</strong>
            </div>
          )}
          {subtotalValue != null && (
            <div>
              <p className="muted">Subtotal</p>
              <strong>{typeof subtotalValue === 'number' ? formatCurrency(subtotalValue) : subtotalValue}</strong>
            </div>
          )}
          {taxValue != null && (
            <div>
              <p className="muted">Tax</p>
              <strong>{typeof taxValue === 'number' ? formatCurrency(taxValue) : taxValue}</strong>
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
