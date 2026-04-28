import { formatCurrency } from '../../utils/formatCurrency.js';

export default function CustomerPartialOrderModal({
  order,
  open = true,
  onAcceptUpdatedOrder,
  onCancelOrder,
  submitting = false,
  error = '',
  acceptLabel = 'Accept Updated Order',
  cancelLabel = 'Cancel Order',
  canAccept = true,
  canCancel = true,
}) {
  if (!open || !order) {
    return null;
  }

  const restaurantName = getRestaurantName(order);
  const acceptedItems = getAcceptedItems(order);
  const unavailableItems = getUnavailableItems(order);
  const visibleItems = acceptedItems.length || unavailableItems.length ? [...acceptedItems, ...unavailableItems] : getVisibleFallbackItems(order);
  const previousTotal = resolvePreviousTotal(order, acceptedItems, unavailableItems, visibleItems);
  const updatedTotal = resolveUpdatedTotal(order, acceptedItems, visibleItems);
  const handleDismiss = () => {
    if (!submitting) {
      onCancelOrder?.();
    }
  };

  return (
    <div className="customer-partial-modal-backdrop" role="presentation" onClick={handleDismiss}>
      <section
        className="customer-partial-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-partial-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="customer-partial-modal__close"
          onClick={handleDismiss}
          aria-label="Close updated order modal"
        >
          ×
        </button>

        <header className="customer-partial-modal__header">
          <p className="customer-partial-modal__eyebrow">⚠️ Order update from the restaurant</p>
          <h2 id="customer-partial-modal-title">{restaurantName} needs your review</h2>
          {order?.kitchenNote ? <p className="customer-partial-modal__note">{order.kitchenNote}</p> : null}
          <p className="customer-partial-modal__subnote">Please review the updated order before continuing.</p>
          {error ? <p className="customer-partial-modal__error">{error}</p> : null}
        </header>

        <section className="customer-partial-modal__items" aria-label="Updated order items">
          <div className="customer-partial-modal__section-title">
            <p>Your Order</p>
          </div>

          <ul className="customer-partial-modal__items-list">
            {acceptedItems.map((item) => (
              <li key={`accepted-${getItemKey(item)}`} className="customer-partial-modal__item customer-partial-modal__item--accepted">
                <div className="customer-partial-modal__item-icon" aria-hidden="true">
                  ✔
                </div>
                <div className="customer-partial-modal__item-copy">
                  <strong>{formatItemLine(item)}</strong>
                  <span>{formatCurrency(getLineTotal(item))}</span>
                </div>
              </li>
            ))}

            {unavailableItems.map((item) => (
              <li key={`unavailable-${getItemKey(item)}`} className="customer-partial-modal__item customer-partial-modal__item--unavailable">
                <div className="customer-partial-modal__item-icon customer-partial-modal__item-icon--unavailable" aria-hidden="true">
                  ❌
                </div>
                <div className="customer-partial-modal__item-copy">
                  <strong>{formatItemLine(item)}</strong>
                  <span>Not available today</span>
                </div>
              </li>
            ))}

            {!acceptedItems.length && !unavailableItems.length && visibleItems.length ? (
              visibleItems.map((item) => (
                <li key={`visible-${getItemKey(item)}`} className="customer-partial-modal__item customer-partial-modal__item--accepted">
                  <div className="customer-partial-modal__item-icon" aria-hidden="true">
                    ✔
                  </div>
                  <div className="customer-partial-modal__item-copy">
                    <strong>{formatItemLine(item)}</strong>
                    <span>{formatCurrency(getLineTotal(item))}</span>
                  </div>
                </li>
              ))
            ) : null}
          </ul>
        </section>

        <section className="customer-partial-modal__totals" aria-label="Order totals">
          <div>
            <span>Previous total:</span>
            <strong>{formatCurrency(previousTotal)}</strong>
          </div>
          <div>
            <span>Updated total:</span>
            <strong>{formatCurrency(updatedTotal)}</strong>
          </div>
        </section>

        <footer className="customer-partial-modal__actions">
          <button type="button" className="primary-btn emphasis" onClick={onAcceptUpdatedOrder} disabled={submitting || !canAccept}>
            {submitting ? 'Updating…' : acceptLabel}
          </button>
          <button type="button" className="primary-btn secondary" onClick={onCancelOrder} disabled={submitting || !canCancel}>
            {cancelLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function getRestaurantName(order) {
  return order?.restaurant?.name || order?.restaurantName || order?.restaurant_name || 'Your restaurant';
}

function getAcceptedItems(order) {
  return normalizeItems(order?.acceptedItems || order?.accepted_items);
}

function getUnavailableItems(order) {
  return normalizeItems(order?.unavailableItems || order?.unavailable_items);
}

function getVisibleFallbackItems(order) {
  return normalizeItems(order?.items || []);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(Boolean).map((item, index) => ({
    ...item,
    quantity: normalizeQuantity(item?.quantity),
    __fallbackKey: item?.id || item?.sku || item?.name || `item-${index}`,
  }));
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function getLineTotal(item) {
  const quantity = normalizeQuantity(item?.quantity);
  const price = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0);
  return quantity * (Number.isFinite(price) ? price : 0);
}

function formatItemLine(item) {
  return `${normalizeQuantity(item?.quantity)} x ${getItemName(item)}`;
}

function getItemName(item) {
  return item?.name || item?.title || item?.label || item?.menuItemName || 'Item';
}

function getItemKey(item) {
  return item?.id || item?.sku || item?.menuItemId || item?.menu_item_id || item?.__fallbackKey || getItemName(item);
}

function resolvePreviousTotal(order, acceptedItems, unavailableItems, visibleItems) {
  const direct =
    order?.previousTotal ??
    order?.previous_total ??
    order?.originalTotal ??
    order?.original_total ??
    order?.totalBeforeAcceptance ??
    order?.total_before_acceptance ??
    order?.subtotalBeforeAcceptance ??
    order?.subtotal_before_acceptance;
  if (isUsableNumber(direct)) {
    return Number(direct);
  }

  if (acceptedItems.length && unavailableItems.length) {
    return sumItemTotals([...acceptedItems, ...unavailableItems]);
  }

  if (visibleItems.length) {
    return sumItemTotals(visibleItems);
  }

  return resolveUpdatedTotal(order, acceptedItems, visibleItems);
}

function resolveUpdatedTotal(order, acceptedItems, visibleItems) {
  const displayCandidates = [
    order?.payableAmountDisplay,
    order?.estimatedTotalDisplay,
    order?.finalAmountDisplay,
    order?.totalDisplay,
  ];
  for (const candidate of displayCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  const numericCandidates = [order?.payableAmount, order?.finalAmount, order?.total];
  for (const candidate of numericCandidates) {
    if (isUsableNumber(candidate)) {
      return Number(candidate);
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  if (acceptedItems.length) {
    return sumItemTotals(acceptedItems);
  }

  return sumItemTotals(visibleItems);
}

function sumItemTotals(items) {
  return items.reduce((sum, item) => sum + getLineTotal(item), 0);
}

function isUsableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
