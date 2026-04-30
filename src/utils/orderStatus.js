const ORDER_STATUS_SEQUENCE = ['new', 'accepted', 'preparing', 'ready_for_pickup', 'completed', 'rejected', 'cancelled'];

const ORDER_STATUS_LABELS = {
  new: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const ORDER_STATUS_TONES = {
  new: 'upcoming',
  accepted: 'upcoming',
  preparing: 'upcoming',
  ready_for_pickup: 'ready',
  completed: 'past',
  rejected: 'cancelled',
  cancelled: 'cancelled',
};

export function normalizeOrderStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

  if (normalized === 'canceled') {
    return 'cancelled';
  }

  return normalized;
}

export function isPartialAcceptedOrder(order) {
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

export function getOrderStatusLabel(status) {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_LABELS[normalized] || formatStatusFallback(normalized);
}

export function getCustomerOrderStatusLabel(order) {
  if (isPartialAcceptedOrder(order)) {
    return 'Partially Accepted';
  }

  return getOrderStatusLabel(order?.status);
}

export function getOrderStatusTone(status, order) {
  if (isPartialAcceptedOrder(order)) {
    return 'partial';
  }

  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_TONES[normalized] || 'past';
}

export function getOrderStatusStepIndex(status) {
  return ORDER_STATUS_SEQUENCE.indexOf(normalizeOrderStatus(status));
}

function formatStatusFallback(status) {
  if (!status) {
    return '';
  }

  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(Boolean);
}
