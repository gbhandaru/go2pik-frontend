import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import KitchenOrderCard from '../components/kitchen/KitchenOrderCard.jsx';
import KitchenTabs from '../components/kitchen/KitchenTabs.jsx';
import { restaurantUserLogout } from '../api/authApi.js';
import { resolveKitchenOrderActionId, updateOrderStatus } from '../api/ordersApi.js';
import { useKitchenOrders } from '../hooks/useKitchenOrders.js';
import { clearKitchenAuthTokens, getKitchenRefreshToken } from '../services/authStorage.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const STATUS_FLOW = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready_for_pickup',
  ready_for_pickup: 'completed',
};

const NEW_TAB_ACTIONS = [
  { label: 'Accept', status: 'accepted', variant: 'emphasis' },
  { label: 'Partially Accept', status: 'partially_accepted', variant: 'warning' },
  { label: 'Reject', status: 'rejected', variant: 'danger' },
];

const ALERT_BEEP_MS = 10000;
const REFRESH_INTERVAL_MS = 60000;
const DEFAULT_SOUND_VOLUME = 0.65;

const STORAGE_KEYS = {
  compactMode: 'go2pik.kitchen.compactMode',
  soundEnabled: 'go2pik.kitchen.soundEnabled',
  soundVolume: 'go2pik.kitchen.soundVolume',
  notificationsEnabled: 'go2pik.kitchen.notificationsEnabled',
  filterMode: 'go2pik.kitchen.filterMode',
  refreshInterval: 'go2pik.kitchen.refreshInterval',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All New' },
  { value: 'high_value', label: 'High Value' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'scheduled', label: 'Scheduled Pickup' },
];

const BASE_TAB_CONFIG = [
  { value: 'new', label: 'New' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'completed', label: 'Completed' },
];

const MAIN_TABS = [
  { value: 'orders', label: 'Order' },
  { value: 'menu', label: 'Menu' },
];

const TAB_SUBTITLE = {
  new: 'Review incoming pickup tickets and accept them quickly.',
  accepted: 'Move accepted tickets onto the line and start prep.',
  preparing: 'Track orders on the line and mark them ready when bagged.',
  ready_for_pickup: 'Stage completed bags and mark pickups when guests arrive.',
  completed: 'Reference pickups completed recently for quick lookups.',
};

const EMPTY_MESSAGES = {
  new: 'No new orders',
  accepted: 'No accepted orders',
  preparing: 'No orders in preparation',
  ready_for_pickup: 'No ready-for-pickup orders',
  completed: 'No completed orders yet',
};

function safeParseStoredValue(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function storeValue(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

function formatTimestamp(date) {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatWaitLabel(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '<1m';
  }

  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getOrderTimestamp(order) {
  return order.createdAt || order.placedAt || order.completedAt || null;
}

function getOrderAgeMinutes(order) {
  const timestamp = getOrderTimestamp(order);
  if (!timestamp) return 0;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 0;

  return Math.max(0, (Date.now() - date.getTime()) / 60000);
}

function getOrderItemsCount(order) {
  return typeof order.totalItems === 'number'
    ? order.totalItems
    : order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
}

function getOrderTotalValue(order) {
  if (typeof order.total === 'number') return order.total;
  const parsed = Number(order.total);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isScheduledOrder(order) {
  return String(order.pickupType || '').toLowerCase().includes('scheduled');
}

function isHighValueOrder(order) {
  return getOrderTotalValue(order) >= 50;
}

function isPriorityOrder(order) {
  const age = getOrderAgeMinutes(order);
  return age >= 20 || isHighValueOrder(order) || getOrderItemsCount(order) >= 6;
}

function getPriorityLabel(order) {
  const age = getOrderAgeMinutes(order);
  if (age >= 20) return 'Urgent';
  if (isHighValueOrder(order)) return 'High value';
  if (getOrderItemsCount(order) >= 6) return 'Large order';
  return null;
}

function sortByOldestFirst(list) {
  return [...list].sort((a, b) => getOrderAgeMinutes(b) - getOrderAgeMinutes(a));
}

function playBeep(volume = DEFAULT_SOUND_VOLUME) {
  if (typeof window === 'undefined') {
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const normalizedVolume = Math.min(1, Math.max(0, volume));

  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gainNode.gain.value = 0.0001;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  const now = context.currentTime;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.02, normalizedVolume), now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  oscillator.start(now);
  oscillator.stop(now + 0.22);

  oscillator.onended = () => {
    context.close().catch(() => {});
  };
}

function createPartialAcceptDraft(order) {
  const items = normalizePartialAcceptItems(order);
  return {
    order,
    items,
    selectedItemIds: items.map((item) => String(item.id)),
    note: '',
    error:
      Array.isArray(order?.items) && order.items.length > 0 && items.length === 0
        ? 'Unable to partially accept this order because item ids are missing from the backend response.'
        : '',
  };
}

function buildPartialAcceptFeedback(notification, order, actionOrderId) {
  if (!notification || typeof notification !== 'object') {
    return null;
  }

  const orderLabel = order?.orderNumber || actionOrderId || 'order';
  const reason = typeof notification.reason === 'string' ? notification.reason.trim() : '';
  const messageSid = typeof notification.messageSid === 'string' ? notification.messageSid.trim() : '';

  if (notification.delivered === true) {
    return {
      kind: 'success',
      message: `Order #${orderLabel} updated. SMS review link sent to customer.`,
      label: 'Delivered',
      details: reason || messageSid || null,
    };
  }

  if (notification.skipped === true) {
    return {
      kind: 'info',
      message: `Order #${orderLabel} updated. SMS review link was skipped.`,
      label: 'Skipped',
      details: reason || messageSid || null,
    };
  }

  if (notification.delivered === false && notification.skipped === false) {
    return {
      kind: 'info',
      message: `Order #${orderLabel} updated. SMS delivery needs support review.`,
      label: 'Delivery failed',
      details: reason || notification.error || messageSid || null,
    };
  }

  return null;
}

function normalizePartialAcceptItems(order) {
  const rawItems = order?.items || [];

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map((item) => ({
      id: item?.id,
      name: item?.name || item?.title || item?.label || 'Item',
      quantity: Number(item?.quantity || 1),
      price: Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0),
      notes: getItemInstructions(item),
    }))
    .filter((item) => item.id != null && item.name);
}

function orderHasStrictItemIds(order) {
  const rawItems = Array.isArray(order?.items) ? order.items : [];
  return rawItems.length > 0 && rawItems.every((item) => item?.id != null);
}

function PartialAcceptModal({
  order,
  items,
  selectedItemIds,
  note,
  error,
  onClose,
  onToggleItem,
  onNoteChange,
  onSubmit,
  submitting = false,
}) {
  if (!order) return null;

  const orderNumber = order.orderNumber || order.displayId || order.id;
  const customerName = order.customerName || order.customer?.name || 'Guest';
  const placedAtLabel = formatOrderPlacedAt(order);
  const selectedItems = items.filter((item) => selectedItemIds.includes(String(item.id)));
  const unavailableItems = items.filter((item) => !selectedItemIds.includes(String(item.id)));
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const remainingCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const unavailableCount = unavailableItems.reduce((sum, item) => sum + item.quantity, 0);
  const buttonDisabled = selectedItems.length === 0 || submitting || Boolean(error);
  const noteText = note || '';

  return (
    <div
      className="kitchen-partial-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="kitchen-partial-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partial-accept-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="kitchen-partial-modal__close" onClick={onClose} aria-label="Close partial accept modal">
          ×
        </button>

        <header className="kitchen-partial-modal__header">
          <p className="kitchen-partial-modal__eyebrow">Kitchen Dashboard</p>
          <h2 id="partial-accept-title">Partially Accept Order</h2>
        </header>

        <div className="kitchen-partial-modal__summary">
          <div>
            <p className="muted">Order #{orderNumber}</p>
            <strong>{customerName}</strong>
          </div>
          <div className="kitchen-partial-modal__summary-grid">
            <div>
              <span className="muted">Placed at:</span>
              <strong>{placedAtLabel}</strong>
            </div>
            <div>
              <span className="muted">Order total:</span>
              <strong>{formatCurrency(order.total ?? order.totalDisplay ?? selectedSubtotal)}</strong>
            </div>
          </div>
        </div>

        <section className="kitchen-partial-modal__items">
          <div className="kitchen-partial-modal__section-title">
            <strong>Order Items</strong>
            <span className="muted">Checked items stay on the order.</span>
          </div>
          {error ? <div className="kitchen-partial-modal__inline-error">{error}</div> : null}
          <div className="kitchen-partial-modal__items-header">
            <span />
            <span className="muted">Price</span>
          </div>
          <div className="kitchen-partial-modal__items-list">
            {items.map((item) => {
              const checked = selectedItemIds.includes(String(item.id));
              return (
                <label key={item.id} className="kitchen-partial-modal__item">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleItem(String(item.id))}
                  />
                  <div className="kitchen-partial-modal__item-copy">
                    <span className="kitchen-partial-modal__item-name">
                      {item.name} <span className="muted">Qty. {item.quantity}</span>
                    </span>
                    {item.notes ? <span className="kitchen-partial-modal__item-note">{item.notes}</span> : null}
                  </div>
                  <strong>{formatCurrency(item.price * item.quantity)}</strong>
                </label>
              );
            })}
          </div>

          <div className="kitchen-partial-modal__warning">
            Checked items will be marked unavailable and removed from this order.
          </div>
        </section>

        <section className="kitchen-partial-modal__reason">
          <div className="kitchen-partial-modal__section-title">
            <strong>Reason for Partial Acceptance</strong>
          </div>
          <textarea
            rows="3"
            value={noteText}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="We are out of paneer and samosas. The remaining items are available for pickup."
          />
          <p className="kitchen-partial-modal__customer-note">
            Customer will be asked to review the updated order.
          </p>
        </section>

        <section className="kitchen-partial-modal__totals">
          <div>
            <span className="muted">Unavailable:</span>
            <strong>{unavailableCount} items</strong>
          </div>
          <div>
            <span className="muted">Remaining:</span>
            <strong>{remainingCount} items</strong>
          </div>
          <div className="kitchen-partial-modal__totals-grand">
            <span className="muted">Updated total:</span>
            <strong>{formatCurrency(selectedSubtotal)}</strong>
          </div>
        </section>

        <footer className="kitchen-partial-modal__actions">
          <button type="button" className="primary-btn secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn emphasis"
            onClick={onSubmit}
            disabled={buttonDisabled}
          >
            {submitting ? 'Partially Accepting…' : 'Partially Accept'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatOrderPlacedAt(order) {
  const raw =
    order?.createdAt ||
    order?.placedAt ||
    order?.created_at ||
    order?.submittedAt ||
    order?.submitted_at ||
    null;
  if (!raw) {
    return '—';
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

export default function KitchenOrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeStatus, setActiveStatus] = useState(() => location.state?.activeStatus || 'new');
  const [refreshInterval, setRefreshInterval] = useState(() =>
    safeParseStoredValue(STORAGE_KEYS.refreshInterval, 60000),
  );
  const { orders: activeOrders, loading, error, refresh, lastUpdated } = useKitchenOrders(
    activeStatus,
    refreshInterval,
  );
  const { orders: newOrders, refresh: refreshNew } = useKitchenOrders('new', refreshInterval);
  const [updatingId, setUpdatingId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [filterMode, setFilterMode] = useState(() =>
    safeParseStoredValue(STORAGE_KEYS.filterMode, 'all'),
  );
  const [compactMode, setCompactMode] = useState(() =>
    safeParseStoredValue(STORAGE_KEYS.compactMode, false),
  );
  const [soundEnabled, setSoundEnabled] = useState(() =>
    safeParseStoredValue(STORAGE_KEYS.soundEnabled, true),
  );
  const [soundVolume, setSoundVolume] = useState(() =>
    safeParseStoredValue(STORAGE_KEYS.soundVolume, DEFAULT_SOUND_VOLUME),
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
    safeParseStoredValue(STORAGE_KEYS.notificationsEnabled, false),
  );
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported',
  );
  const [actionError, setActionError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [partialAcceptOrder, setPartialAcceptOrder] = useState(null);
  const beepTimerRef = useRef(null);
  const previousNewCountRef = useRef(0);
  const feedbackTimerRef = useRef(null);

  const headerSubtitle = TAB_SUBTITLE[activeStatus];
  const tabConfig = BASE_TAB_CONFIG.map((tab) =>
    tab.value === 'new' ? { ...tab, count: newOrders.length } : tab,
  );

  useEffect(() => {
    storeValue(STORAGE_KEYS.filterMode, filterMode);
  }, [filterMode]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.refreshInterval, refreshInterval);
  }, [refreshInterval]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.compactMode, compactMode);
  }, [compactMode]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.soundEnabled, soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.soundVolume, soundVolume);
  }, [soundVolume]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.notificationsEnabled, notificationsEnabled);
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!feedback) return undefined;

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 4000);

    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [feedback]);

  const visibleOrders = useMemo(() => {
    if (activeStatus !== 'new') {
      return activeOrders;
    }

    let filtered = [...activeOrders];
    if (filterMode === 'high_value') {
      filtered = filtered.filter(isHighValueOrder);
    } else if (filterMode === 'scheduled') {
      filtered = filtered.filter(isScheduledOrder);
    }

    return sortByOldestFirst(filtered);
  }, [activeOrders, activeStatus, filterMode]);

  const newPriorityCount = useMemo(() => newOrders.filter(isPriorityOrder).length, [newOrders]);
  const newHighValueCount = useMemo(() => newOrders.filter(isHighValueOrder).length, [newOrders]);
  const oldestNewWaitMinutes = useMemo(() => {
    if (!newOrders.length) return 0;
    return Math.max(...newOrders.map(getOrderAgeMinutes));
  }, [newOrders]);
  useEffect(() => {
    if (!soundEnabled || !newOrders.length || soundVolume <= 0) {
      if (beepTimerRef.current) {
        clearInterval(beepTimerRef.current);
        beepTimerRef.current = null;
      }
      return undefined;
    }

    const beep = () => {
      if (document.visibilityState === 'visible' && newOrders.length > 0) {
        playBeep(soundVolume);
      }
    };

    beepTimerRef.current = window.setInterval(beep, ALERT_BEEP_MS);

    return () => {
      if (beepTimerRef.current) {
        clearInterval(beepTimerRef.current);
        beepTimerRef.current = null;
      }
    };
  }, [newOrders.length, soundEnabled, soundVolume]);

  useEffect(() => {
    if (!notificationsEnabled || notificationPermission !== 'granted') {
      previousNewCountRef.current = newOrders.length;
      return undefined;
    }

    const previous = previousNewCountRef.current;
    if (newOrders.length > previous) {
      const delta = newOrders.length - previous;
      const title = delta === 1 ? '1 new order received' : `${delta} new orders received`;
      const body = `${newOrders.length} orders waiting in the New queue.`;
      try {
        const notification = new window.Notification(title, {
          body,
          tag: 'go2pik-kitchen-new-orders',
          renotify: true,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        // Ignore notification failures; the badge and sound still work.
      }
    }

    previousNewCountRef.current = newOrders.length;
    return undefined;
  }, [newOrders.length, notificationsEnabled, notificationPermission]);

  const handleTabChange = (status) => {
    setActionError(null);
    setActiveStatus(status);
  };

  const handleMainTabChange = (tab) => {
    if (tab === 'menu') {
      navigate('/kitchen/menu');
      return;
    }

    navigate('/kitchen/orders');
  };

  const handleStatusChange = async (order, targetStatus, options = {}) => {
    if (!targetStatus) return;
    const actionOrderId = resolveKitchenOrderActionId(order);
    if (!actionOrderId) {
      setActionError('Unable to determine order id');
      return false;
    }

    setActionError(null);
    setUpdatingId(actionOrderId);
    setUpdatingStatus(targetStatus);
    try {
      const response = await updateOrderStatus(actionOrderId, targetStatus, options);
      await Promise.all([refresh(), refreshNew()]);
      if (targetStatus === 'completed') {
        setActiveStatus('completed');
      }
      if (targetStatus === 'partially_accepted') {
        console.info('Partial accept response', response);
        const notificationFeedback = buildPartialAcceptFeedback(response?.notification, order, actionOrderId);
        setFeedback(
          notificationFeedback || {
            kind: 'success',
            message: response?.message || `Order #${order.orderNumber || actionOrderId} moved to ${targetStatus.replace(/_/g, ' ')}`,
          },
        );
      } else {
        setFeedback({
          kind: 'success',
          message: response?.message || `Order #${order.orderNumber || actionOrderId} moved to ${targetStatus.replace(/_/g, ' ')}`,
        });
      }
      return response;
    } catch (err) {
      setActionError(err.message || 'Unable to update order status');
      return false;
    } finally {
      setUpdatingId(null);
      setUpdatingStatus(null);
    }
  };

  const handleRejectOrder = async (order) => {
    const rejectReason =
      window.prompt('Reason for rejection', 'Item unavailable') || 'Rejected from kitchen dashboard';
    await handleStatusChange(order, 'rejected', { rejectReason });
  };

  const handleOpenPartialAccept = (order) => {
    setActionError(null);
    setPartialAcceptOrder(createPartialAcceptDraft(order));
  };

  const handleClosePartialAccept = () => {
    setPartialAcceptOrder(null);
  };

  const handleTogglePartialAcceptItem = (itemId) => {
    setPartialAcceptOrder((current) => {
      if (!current) return current;

      const nextSelected = new Set(current.selectedItemIds);
      if (nextSelected.has(itemId)) {
        nextSelected.delete(itemId);
      } else {
        nextSelected.add(itemId);
      }

      return {
        ...current,
        selectedItemIds: Array.from(nextSelected),
      };
    });
  };

  const handlePartialAcceptNoteChange = (value) => {
    setPartialAcceptOrder((current) => {
      if (!current) return current;
      return {
        ...current,
        note: value,
      };
    });
  };

  const handleSubmitPartialAccept = async () => {
    if (!partialAcceptOrder) return;

    const selectedItems = partialAcceptOrder.items.filter((item) =>
      partialAcceptOrder.selectedItemIds.includes(String(item.id)),
    );
    if (!selectedItems.length) return;

    const rejectedItems = partialAcceptOrder.items.filter(
      (item) => !partialAcceptOrder.selectedItemIds.includes(String(item.id)),
    );

    const success = await handleStatusChange(partialAcceptOrder.order, 'partially_accepted', {
      accepted_item_ids: selectedItems.map((item) => item.id),
      unavailable_item_ids: rejectedItems.map((item) => item.id),
      note: partialAcceptOrder.note.trim() || undefined,
    });
    if (success) {
      setPartialAcceptOrder(null);
      setActiveStatus('accepted');
    }
  };

  const handleToggleCompact = () => {
    setCompactMode((current) => !current);
  };

  const handleToggleSound = () => {
    setSoundEnabled((current) => !current);
  };

  const handleSoundVolumeChange = (event) => {
    setSoundVolume(Number(event.target.value));
  };

  const handleToggleNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setFeedback({ kind: 'error', message: 'Desktop notifications are not supported in this browser.' });
      return;
    }

    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      setFeedback({ kind: 'info', message: 'Desktop notifications disabled.' });
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      setFeedback({ kind: 'success', message: 'Desktop notifications enabled.' });
    } else {
      setFeedback({ kind: 'error', message: 'Desktop notifications were not enabled.' });
    }
  };

  const handleLogout = async () => {
    const refreshToken = getKitchenRefreshToken();
    try {
      if (refreshToken) {
        await restaurantUserLogout(refreshToken);
      }
    } catch (error) {
      console.warn('Failed to notify server about kitchen logout', error);
    } finally {
      clearKitchenAuthTokens();
      navigate('/kitchen/login', { replace: true });
    }
  };

  let ordersContent = null;
  if (loading) {
    ordersContent = <div className="kitchen-empty-state">Loading orders…</div>;
  } else if (error) {
    ordersContent = <div className="kitchen-empty-state">{error}</div>;
  } else if (!visibleOrders?.length) {
    ordersContent = <div className="kitchen-empty-state">{EMPTY_MESSAGES[activeStatus]}</div>;
  } else {
    ordersContent = (
      <section className={`kitchen-orders-grid${compactMode ? ' kitchen-orders-grid--compact' : ''}`}>
        {visibleOrders.map((order) => {
          const actionOrderId = resolveKitchenOrderActionId(order);
          const ageMinutes = activeStatus === 'new' ? getOrderAgeMinutes(order) : null;
          return (
            <KitchenOrderCard
              key={order.id}
              order={order}
              compact={compactMode}
              ageMinutes={ageMinutes}
              actions={
                activeStatus === 'new'
                  ? NEW_TAB_ACTIONS.map((action) => ({
                      ...action,
                      onClick:
                        action.status === 'rejected'
                          ? () => handleRejectOrder(order)
                          : action.status === 'partially_accepted'
                            ? () => handleOpenPartialAccept(order)
                          : () => handleStatusChange(order, action.status),
                    }))
                  : STATUS_FLOW[order.status]
                    ? [
                        {
                          label:
                            order.status === 'accepted'
                              ? 'Start Preparing'
                              : order.status === 'preparing'
                                ? 'Mark Ready'
                                : order.status === 'ready_for_pickup'
                                  ? 'Complete Pickup'
                                  : 'Accept',
                          status: STATUS_FLOW[order.status],
                          variant: 'primary',
                          onClick: () => handleStatusChange(order, STATUS_FLOW[order.status]),
                        },
                      ]
                    : []
              }
              actionLoading={updatingId === actionOrderId}
              loadingActionStatus={updatingId === actionOrderId ? updatingStatus : null}
            />
          );
        })}
      </section>
    );
  }

  return (
    <main className={`page-section kitchen-page kitchen-dashboard${compactMode ? ' kitchen-page--compact' : ''}`}>
      <header className="card kitchen-dashboard__topbar">
        <div className="kitchen-dashboard__brand">
          <p className="kitchen-dashboard__eyebrow">GO2PIK KITCHEN</p>
          <h1>Kitchen Dashboard</h1>
        </div>
        <div className="kitchen-dashboard__updated">
          <span>Last updated: {formatTimestamp(lastUpdated)}</span>
        </div>
        <div className="kitchen-dashboard__actions">
          <Link className="kitchen-icon-btn kitchen-icon-btn--link" to="/kitchen/users/new" aria-label="Create restaurant user">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 7v-1a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v1h-2v-1a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3v1Zm11-10V8h-2V5h-2v3h-2v2h2v3h2v-3Z" />
            </svg>
          </Link>
          <button
            type="button"
            className={`kitchen-icon-btn${notificationsEnabled && notificationPermission === 'granted' ? ' active' : ''}`}
            onClick={handleToggleNotifications}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22a2.2 2.2 0 0 0 2.1-1.6H9.9A2.2 2.2 0 0 0 12 22Zm7-5.5-1.6-1.6V11a5.4 5.4 0 0 0-4.2-5.2V4.6a1.2 1.2 0 1 0-2.4 0v1.2A5.4 5.4 0 0 0 6.6 11v3.9L5 16.5v1h14v-1Z" />
            </svg>
          </button>
          <button type="button" className="kitchen-icon-btn" onClick={refresh} aria-label="Refresh now">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.6V4h2v8h-8V10l2.7 2.7A6 6 0 1 0 18 17h2a8 8 0 1 1-16-5Z" />
            </svg>
          </button>
          <button type="button" className="kitchen-icon-btn" onClick={handleLogout} aria-label="Logout">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17v-2h4V9h-4V7l-5 5 5 5Zm9-13H12V2h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-7v-2h7V4Z" />
            </svg>
          </button>
        </div>
      </header>

      {actionError && <p style={{ color: '#dc2626', fontWeight: 600 }}>{actionError}</p>}
      {feedback ? (
        <div className={`kitchen-feedback kitchen-feedback--${feedback.kind}`}>
          <div className="kitchen-feedback__row">
            {feedback.label ? <span className="kitchen-feedback__tag">{feedback.label}</span> : null}
            <span>{feedback.message}</span>
          </div>
          {feedback.details ? <small className="kitchen-feedback__details">{feedback.details}</small> : null}
        </div>
      ) : null}
      {partialAcceptOrder ? (
        <PartialAcceptModal
          order={partialAcceptOrder.order}
          items={partialAcceptOrder.items}
          selectedItemIds={partialAcceptOrder.selectedItemIds}
          note={partialAcceptOrder.note}
          error={partialAcceptOrder.error}
          onClose={handleClosePartialAccept}
          onToggleItem={handleTogglePartialAcceptItem}
          onNoteChange={handlePartialAcceptNoteChange}
          onSubmit={handleSubmitPartialAccept}
          submitting={updatingId === resolveKitchenOrderActionId(partialAcceptOrder.order)}
        />
      ) : null}

      <section className="card kitchen-toolbar kitchen-main-tabs">
        <KitchenTabs tabs={MAIN_TABS} activeTab="orders" onTabChange={handleMainTabChange} />
      </section>

      <section className="card kitchen-toolbar">
        <KitchenTabs tabs={tabConfig} activeTab={activeStatus} onTabChange={handleTabChange} />
        <div className="kitchen-toolbar__controls">
          <button type="button" className={`kitchen-pill-switch${soundEnabled ? ' active' : ''}`} onClick={handleToggleSound}>
            <span>Sound</span>
            <strong>{soundEnabled ? 'On' : 'Off'}</strong>
          </button>
        </div>
      </section>

      {ordersContent}
    </main>
  );
}
