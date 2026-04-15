import { useEffect, useMemo, useRef, useState } from 'react';
import KitchenOrderCard from '../components/kitchen/KitchenOrderCard.jsx';
import KitchenTabs from '../components/kitchen/KitchenTabs.jsx';
import { updateOrderStatus } from '../api/ordersApi.js';
import { useKitchenOrders } from '../hooks/useKitchenOrders.js';

const STATUS_FLOW = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready_for_pickup',
  ready_for_pickup: 'completed',
};

const NEW_TAB_ACTIONS = [
  { label: 'Accept', status: 'accepted', variant: 'primary' },
  { label: 'Reject', status: 'rejected', variant: 'quiet' },
  { label: 'Complete', status: 'completed', variant: 'secondary' },
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

export default function KitchenOrdersPage() {
  const [activeStatus, setActiveStatus] = useState('new');
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
  const [bulkActionStatus, setBulkActionStatus] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
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
  const selectedVisibleOrders = useMemo(
    () => visibleOrders.filter((order) => selectedOrderIds.includes(order.id)),
    [visibleOrders, selectedOrderIds],
  );

  useEffect(() => {
    if (activeStatus !== 'new') {
      setSelectedOrderIds([]);
      return;
    }

    setSelectedOrderIds((current) =>
      current.filter((id) => activeOrders.some((order) => order.id === id)),
    );
  }, [activeStatus, activeOrders]);

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
    if (status !== 'new') {
      setSelectedOrderIds([]);
    }
  };

  const handleStatusChange = async (order, targetStatus, options = {}) => {
    if (!targetStatus) return;
    setActionError(null);
    setUpdatingId(order.id);
    setUpdatingStatus(targetStatus);
    try {
      await updateOrderStatus(order.id, targetStatus, options);
      await Promise.all([refresh(), refreshNew()]);
      setFeedback({
        kind: 'success',
        message: `Order #${order.orderNumber || order.id} moved to ${targetStatus.replace(/_/g, ' ')}`,
      });
      setSelectedOrderIds((current) => current.filter((id) => id !== order.id));
    } catch (err) {
      setActionError(err.message || 'Unable to update order status');
    } finally {
      setUpdatingId(null);
      setUpdatingStatus(null);
    }
  };

  const handleBulkStatusChange = async (targetStatus) => {
    if (!selectedVisibleOrders.length) {
      return;
    }

    let rejectReason = null;
    if (targetStatus === 'rejected') {
      rejectReason =
        window.prompt('Reason for rejection', 'Item unavailable') || 'Rejected from kitchen dashboard';
    }

    setActionError(null);
    setBulkActionStatus(targetStatus);
    try {
      for (const order of selectedVisibleOrders) {
        // eslint-disable-next-line no-await-in-loop
        await updateOrderStatus(order.id, targetStatus, {
          rejectReason,
        });
      }

      await Promise.all([refresh(), refreshNew()]);
      setFeedback({
        kind: 'success',
        message: `${selectedVisibleOrders.length} order${
          selectedVisibleOrders.length === 1 ? '' : 's'
        } moved to ${targetStatus.replace(/_/g, ' ')}`,
      });
      setSelectedOrderIds([]);
    } catch (err) {
      setActionError(err.message || 'Unable to update selected orders');
    } finally {
      setBulkActionStatus(null);
    }
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrderIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  };

  const handleSelectAllVisible = () => {
    setSelectedOrderIds(visibleOrders.map((order) => order.id));
  };

  const handleRejectOrder = async (order) => {
    const rejectReason =
      window.prompt('Reason for rejection', 'Item unavailable') || 'Rejected from kitchen dashboard';
    await handleStatusChange(order, 'rejected', { rejectReason });
  };

  const handleClearSelection = () => {
    setSelectedOrderIds([]);
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

  const hasBulkSelection = activeStatus === 'new' && selectedVisibleOrders.length > 0;

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
          const ageMinutes = getOrderAgeMinutes(order);
          const priorityLabel = getPriorityLabel(order);
          const ageLabel = activeStatus === 'new' ? `Waiting ${formatWaitLabel(ageMinutes)}` : null;
          const selected = selectedOrderIds.includes(order.id);

          return (
            <KitchenOrderCard
              key={order.id}
              order={order}
              compact={compactMode}
              showSelection={activeStatus === 'new'}
              selected={selected}
              onSelectChange={activeStatus === 'new' ? () => handleSelectOrder(order.id) : undefined}
              ageLabel={ageLabel}
              priorityLabel={priorityLabel}
              actions={
                activeStatus === 'new'
                  ? NEW_TAB_ACTIONS.map((action) => ({
                      ...action,
                      onClick:
                        action.status === 'rejected'
                          ? () => handleRejectOrder(order)
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
              actionLoading={updatingId === order.id}
              loadingActionStatus={updatingId === order.id ? updatingStatus : null}
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
        </div>
      </header>

      {actionError && <p style={{ color: '#dc2626', fontWeight: 600 }}>{actionError}</p>}
      {feedback && <div className={`kitchen-feedback kitchen-feedback--${feedback.kind}`}>{feedback.message}</div>}

      <section className="card kitchen-toolbar">
        <KitchenTabs tabs={tabConfig} activeTab={activeStatus} onTabChange={handleTabChange} />
        <div className="kitchen-toolbar__controls">
          <label className="kitchen-toolbar__field">
            <span>Auto refresh</span>
            <select value={refreshInterval} onChange={(event) => setRefreshInterval(Number(event.target.value))}>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>60 seconds</option>
            </select>
          </label>
          <button type="button" className={`kitchen-pill-switch${soundEnabled ? ' active' : ''}`} onClick={handleToggleSound}>
            <span>Sound</span>
            <strong>{soundEnabled ? 'On' : 'Off'}</strong>
          </button>
        </div>
      </section>

      {hasBulkSelection && (
        <section className="card kitchen-bulk-bar">
          <div>
            <p className="eyebrow">Bulk actions</p>
            <strong>{selectedVisibleOrders.length} selected</strong>
          </div>
          <div className="kitchen-bulk-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => handleBulkStatusChange('accepted')}
              disabled={bulkActionStatus !== null}
            >
              {bulkActionStatus === 'accepted' ? 'Updating…' : 'Accept selected'}
            </button>
            <button
              type="button"
              className="primary-btn secondary"
              onClick={() => handleBulkStatusChange('rejected')}
              disabled={bulkActionStatus !== null}
            >
              {bulkActionStatus === 'rejected' ? 'Updating…' : 'Reject selected'}
            </button>
            <button
              type="button"
              className="primary-btn secondary"
              onClick={() => handleBulkStatusChange('completed')}
              disabled={bulkActionStatus !== null}
            >
              {bulkActionStatus === 'completed' ? 'Updating…' : 'Complete selected'}
            </button>
            <button
              type="button"
              className="primary-btn ghost"
              onClick={handleClearSelection}
              disabled={bulkActionStatus !== null}
            >
              Clear selection
            </button>
          </div>
        </section>
      )}

      {activeStatus === 'new' && visibleOrders.length > 0 && (
        <section className="kitchen-selection-actions">
          <button type="button" className="kitchen-inline-link" onClick={handleSelectAllVisible}>
            Select all visible
          </button>
          <button type="button" className="kitchen-inline-link" onClick={handleClearSelection}>
            Clear selection
          </button>
        </section>
      )}

      {activeStatus === 'new' && (
        <section className="card kitchen-toolbar kitchen-toolbar--compact">
          <div className="kitchen-toolbar__controls kitchen-toolbar__controls--compact">
            <button
              type="button"
              className={`kitchen-toggle${soundEnabled ? ' active' : ''}`}
              onClick={handleToggleSound}
            >
              Sound <strong>{soundEnabled ? 'On' : 'Off'}</strong>
            </button>
            <button
              type="button"
              className={`kitchen-toggle${compactMode ? ' active' : ''}`}
              onClick={handleToggleCompact}
            >
              Compact Mode
            </button>
            <button
              type="button"
              className={`kitchen-toggle${
                notificationsEnabled && notificationPermission === 'granted' ? ' active' : ''
              }`}
              onClick={handleToggleNotifications}
            >
              {notificationPermission === 'unsupported'
                ? 'Notifications N/A'
                : notificationsEnabled && notificationPermission === 'granted'
                  ? 'Notifications On'
                  : 'Notifications Off'}
            </button>
            <label className="kitchen-toolbar__field kitchen-toolbar__field--inline">
              <span>Auto refresh</span>
              <select value={refreshInterval} onChange={(event) => setRefreshInterval(Number(event.target.value))}>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>60 seconds</option>
              </select>
            </label>
            <button type="button" className="primary-btn kitchen-refresh-btn" onClick={refresh} disabled={loading}>
              Refresh Now
            </button>
          </div>

          <div className="kitchen-filter-row">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`kitchen-filter-chip${filterMode === option.value ? ' active' : ''}`}
                onClick={() => setFilterMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {ordersContent}
    </main>
  );
}
