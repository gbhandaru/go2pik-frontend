import { formatCurrency } from '../../utils/formatCurrency.js';

const ACTION_LABELS = {
  new: 'Accept',
  accepted: 'Start Preparing',
  preparing: 'Mark Ready',
  ready_for_pickup: 'Complete Pickup',
};

const STATUS_LABELS = {
  new: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  rejected: 'Rejected',
};

export default function KitchenOrderCard({ order, onAction, actionLoading = false }) {
  if (!order) return null;

  const orderNumber = order.orderNumber || order.displayId || order.id;
  const pickupType = order.pickupType || 'Pickup';
  const totalItems =
    typeof order.totalItems === 'number'
      ? order.totalItems
      : order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
  const actionLabel = ACTION_LABELS[order.status];
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const hasTotal = typeof order.total === 'number';

  return (
    <article className="kitchen-order-card card">
      <div className="kitchen-order-card__meta">
        <p className="kitchen-order-card__order-number">Order #{orderNumber}</p>
        <div className="kitchen-order-card__pickup">
          <span>{pickupType}</span>
          {order.pickupTime && <strong>{order.pickupTime}</strong>}
        </div>
      </div>

      <div className="kitchen-order-card__customer">
        <h2>{order.customerName || 'Guest'}</h2>
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
              <strong>{formatCurrency(order.total)}</strong>
            </div>
          )}
        </div>
        {actionLabel ? (
          <button
            type="button"
            className="primary-btn"
            onClick={onAction}
            disabled={actionLoading || !onAction}
          >
            {actionLoading ? 'Updating…' : actionLabel}
          </button>
        ) : (
          <span className="kitchen-order-card__status">{statusLabel}</span>
        )}
      </footer>
    </article>
  );
}
