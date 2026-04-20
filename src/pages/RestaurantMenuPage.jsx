import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { fetchRestaurantMenu } from '../api/restaurantsApi.js';
import { fetchCustomerOrders } from '../api/customersApi.js';
import AsyncState from '../components/shared/AsyncState.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getRestaurantAddressLines } from '../utils/formatRestaurantAddress.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { clearCustomerOrderVerification, getCustomerOrderDraft, storeCustomerOrderDraft } from '../services/authStorage.js';
import { getCustomerId, getCustomerPhone } from '../utils/customerIdentity.js';

const PICKUP_MODES = {
  ASAP: 'ASAP',
  SCHEDULED: 'SCHEDULED',
};
const PICKUP_WINDOW_MINUTES = 20;
const EARLIEST_PICKUP_MINUTES = 15;
const PICKUP_SLOT_STEP_MINUTES = 15;
const PICKUP_SLOT_LOOKAHEAD_DAYS = 7;

export default function RestaurantMenuPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { user, canAccessCustomerFlow } = useAuth();
  const customerName = useMemo(() => getCustomerDisplayName(user), [user]);
  const customerId = useMemo(() => getCustomerId(user), [user]);
  const initialCustomerPhone = useMemo(() => getCustomerPhone(user) || '', [user]);
  const [cart, setCart] = useState([]);
  const [selectedPickupMode, setSelectedPickupMode] = useState(PICKUP_MODES.ASAP);
  const [scheduledPickupTime, setScheduledPickupTime] = useState('');
  const [orderError, setOrderError] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState(initialCustomerPhone);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const phoneInputRef = useRef(null);
  const { data, loading, error, errorInfo } = useFetch(
    () => fetchRestaurantMenu(restaurantId),
    [restaurantId, retryKey],
  );
  const {
    data: customerOrdersData,
  } = useFetch(
    () =>
      customerId
        ? fetchCustomerOrders(customerId)
        : Promise.resolve({ customer: null, orders: [] }),
    [customerId, retryKey],
  );
  const asapReadyTime = useMemo(() => getTimeFromNow(PICKUP_WINDOW_MINUTES), []);
  const earliestAvailableTime = useMemo(() => getTimeFromNow(EARLIEST_PICKUP_MINUTES), []);
  const canBrowseMenu = canAccessCustomerFlow;

  useEffect(() => {
    const storedDraft = getCustomerOrderDraft();
    const storedRestaurantId = storedDraft?.restaurantId || storedDraft?.restaurant?.id;
    const matchesRestaurant = storedRestaurantId && String(storedRestaurantId) === String(restaurantId);

    if (matchesRestaurant) {
      setCart(Array.isArray(storedDraft.items) ? storedDraft.items.map((item) => ({ ...item })) : []);
      setSelectedPickupMode(storedDraft?.pickupRequest?.type === PICKUP_MODES.SCHEDULED ? PICKUP_MODES.SCHEDULED : PICKUP_MODES.ASAP);
      setScheduledPickupTime(storedDraft?.pickupRequest?.scheduledTime || '');
      setCustomerPhoneInput(storedDraft?.customer?.phone || storedDraft?.customerPhone || initialCustomerPhone);
      return;
    }

    setCart([]);
    setSelectedPickupMode(PICKUP_MODES.ASAP);
    setScheduledPickupTime('');
  }, [restaurantId, initialCustomerPhone]);

  useEffect(() => {
    setCustomerPhoneInput((prev) => prev || initialCustomerPhone);
  }, [initialCustomerPhone]);

  useEffect(() => {
    if (showPhoneModal) {
      phoneInputRef.current?.focus();
    }
  }, [showPhoneModal]);

  const normalizedCustomerPhone = useMemo(
    () => normalizeUSPhoneNumber(customerPhoneInput),
    [customerPhoneInput],
  );
  const isCustomerPhoneValid = Boolean(normalizedCustomerPhone);
  const phoneValidationMessage =
    customerPhoneInput.trim() && !isCustomerPhoneValid ? 'Please enter a valid US phone number' : '';

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const quantityById = useMemo(
    () =>
      cart.reduce((acc, item) => {
        acc[item.id] = item.quantity;
        return acc;
      }, {}),
    [cart],
  );
  const cartItemById = useMemo(
    () =>
      cart.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [cart],
  );

  const menu = data?.menu || [];
  const categories = data?.categories || data?.menuCategories || data?.menu_categories || [];
  const restaurant = data?.restaurant;
  const pickupAvailability = useMemo(
    () => resolvePickupAvailability(data, restaurant),
    [data, restaurant],
  );
  const pickupSlotGroups = useMemo(
    () => buildPickupSlotGroups(pickupAvailability),
    [pickupAvailability],
  );
  const hasMenuItems = menu.length > 0;

  const lastOrder = useMemo(() => {
    const sourceItems = data?.lastOrder?.items?.length ? data.lastOrder.items : [];
    if (!sourceItems.length) {
      return getLastOrderFromHistory(customerOrdersData?.orders, restaurantId);
    }
    return {
      id: data?.lastOrder?.id || null,
      items: sourceItems,
      summary: sourceItems.map((item) => `${item.quantity}× ${item.name}`).join(', '),
    };
  }, [data?.lastOrder, customerOrdersData?.orders, restaurantId]);

  useEffect(() => {
    if (selectedPickupMode !== PICKUP_MODES.SCHEDULED) {
      return;
    }

    const nextSelected = normalizeScheduledPickupSelection(scheduledPickupTime, pickupAvailability);
    const firstAvailableSlot = pickupSlotGroups[0]?.slots?.[0]?.value || '';

    if (nextSelected && nextSelected !== scheduledPickupTime) {
      setScheduledPickupTime(nextSelected);
      return;
    }

    if (!scheduledPickupTime && firstAvailableSlot) {
      setScheduledPickupTime(firstAvailableSlot);
      return;
    }

    if (scheduledPickupTime && !isPickupSelectionInGroups(scheduledPickupTime, pickupSlotGroups)) {
      setScheduledPickupTime(firstAvailableSlot || '');
    }
  }, [pickupAvailability, pickupSlotGroups, scheduledPickupTime, selectedPickupMode]);

  useEffect(() => {
    if (pickupAvailability.asapAllowed !== false || selectedPickupMode !== PICKUP_MODES.ASAP) {
      return;
    }

    setSelectedPickupMode(PICKUP_MODES.SCHEDULED);
    if (!scheduledPickupTime) {
      const firstAvailableSlot = pickupSlotGroups[0]?.slots?.[0]?.value || '';
      if (firstAvailableSlot) {
        setScheduledPickupTime(firstAvailableSlot);
      }
    }
  }, [pickupAvailability.asapAllowed, pickupSlotGroups, scheduledPickupTime, selectedPickupMode]);

  const addToCart = (menuItem, options = {}) => {
    const identity = resolveMenuItemIdentity(menuItem);
    setCart((prev) => {
      const existing = prev.find((item) => String(item.id) === String(identity));
      if (existing) {
        return prev.map((item) =>
          String(item.id) === String(identity)
            ? {
                ...item,
                quantity: item.quantity + 1,
                specialInstructions: options.specialInstructions ?? item.specialInstructions ?? '',
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          ...menuItem,
          id: identity,
          quantity: 1,
          specialInstructions: options.specialInstructions ?? '',
        },
      ];
    });
  };

  const updateQuantity = (itemId, nextQuantity) => {
    setCart((prev) => {
      if (nextQuantity <= 0) {
        return prev.filter((item) => String(item.id) !== String(itemId));
      }
      return prev.map((item) => (String(item.id) === String(itemId) ? { ...item, quantity: nextQuantity } : item));
    });
  };

  const updateInstructions = (itemId, specialInstructions) => {
    setCart((prev) =>
      prev.map((item) =>
        String(item.id) === String(itemId) ? { ...item, specialInstructions } : item,
      ),
    );
  };

  const reorderLastOrder = () => {
    if (!lastOrder?.items?.length) {
      return;
    }
    setCart((prev) => {
      const nextCart = [...prev];
      lastOrder.items.forEach((orderItem) => {
        const orderItemId = resolveMenuItemIdentity(orderItem);
        const index = nextCart.findIndex((item) => String(item.id) === String(orderItemId));
        if (index > -1) {
          nextCart[index] = {
            ...nextCart[index],
            quantity: nextCart[index].quantity + orderItem.quantity,
          };
        } else {
          nextCart.push({ ...orderItem, id: orderItemId });
        }
      });
      return nextCart;
    });
  };

  const reorderSingleItem = (orderItem) => {
    if (!orderItem) {
      return;
    }
    setCart((prev) => {
      const orderItemId = resolveMenuItemIdentity(orderItem);
      const existing = prev.find((item) => String(item.id) === String(orderItemId));
      if (existing) {
        return prev.map((item) =>
          String(item.id) === String(orderItemId)
            ? {
                ...item,
                quantity: item.quantity + (orderItem.quantity || 1),
                specialInstructions: item.specialInstructions || orderItem.specialInstructions || '',
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          ...orderItem,
          id: orderItemId,
          quantity: orderItem.quantity || 1,
          specialInstructions: orderItem.specialInstructions || '',
        },
      ];
    });
  };

  const handlePickupModeChange = (mode) => {
    setSelectedPickupMode(mode);
    if (mode === PICKUP_MODES.ASAP) {
      setScheduledPickupTime('');
      return;
    }

    if (!scheduledPickupTime) {
      const firstAvailableSlot = pickupSlotGroups[0]?.slots?.[0]?.value || '';
      if (firstAvailableSlot) {
        setScheduledPickupTime(firstAvailableSlot);
      }
    }
  };

  const pickupSummary = getPickupSummary(
    selectedPickupMode,
    scheduledPickupTime,
    asapReadyTime,
    pickupAvailability,
  );
  const missingScheduledTime = selectedPickupMode === PICKUP_MODES.SCHEDULED && !scheduledPickupTime;
  const asapReadyLabel = getAsapReadyLabel(asapReadyTime, pickupAvailability);
  const earliestAvailableLabel = getEarliestAvailableLabel(earliestAvailableTime);
  const menuErrorMessage =
    errorInfo?.offline
      ? 'You appear to be offline. Check your connection and try again.'
      : errorInfo?.kind === 'not_found'
      ? 'This restaurant menu is not available right now.'
      : 'We are having trouble loading this menu. Please try again.';

  const handleRetryMenu = () => {
    setRetryKey((current) => current + 1);
  };

  const handlePlaceOrder = async () => {
    setOrderError('');
    if (!cart.length || !restaurant) {
      return;
    }
    if (selectedPickupMode === PICKUP_MODES.SCHEDULED && !scheduledPickupTime) {
      setOrderError('Choose a pickup time from the available hours.');
      return;
    }
    const draft = buildCustomerOrderDraft({
      cart,
      cartItemById,
      customerName,
      customerPhone: getCustomerPhone(user) || initialCustomerPhone,
      restaurant,
      scheduledPickupTime,
      selectedPickupMode,
      total,
      pickupSummary,
      user,
    });
    storeCustomerOrderDraft(draft);
    setCustomerPhoneInput(getCustomerPhone(user) || initialCustomerPhone);
    setShowPhoneModal(true);
  };

  const handleSendOtp = () => {
    setOrderError('');
    if (!isCustomerPhoneValid) {
      setOrderError('Please enter a valid US phone number');
      return;
    }
    const customerPhone = normalizedCustomerPhone;
    const payload = buildCustomerOrderDraft({
      cart,
      cartItemById,
      customerName,
      customerPhone,
      restaurant,
      scheduledPickupTime,
      selectedPickupMode,
      total,
      pickupSummary,
      user,
    });

    storeCustomerOrderDraft(payload);
    clearCustomerOrderVerification();
    setShowPhoneModal(false);
    navigate('/verification', {
      state: {
        orderDraft: payload,
        customerName: customerName || undefined,
        customerPhone,
        pendingVerification: true,
      },
    });
  };

  if (!canBrowseMenu) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: `/restaurants/${restaurantId}/menu` } }}
      />
    );
  }

  if (loading) {
    return (
      <main className="page-section">
        <AsyncState title="Loading menu" message="Please wait while we load this restaurant." loading />
      </main>
    );
  }

  if (error || !restaurant) {
    return (
      <main className="page-section">
        <AsyncState
          title="Menu unavailable"
          message={menuErrorMessage}
          primaryActionLabel="Retry"
          onPrimaryAction={handleRetryMenu}
          secondaryActionLabel="Back to restaurant list"
          onSecondaryAction={() => navigate('/home')}
        />
      </main>
    );
  }

  return (
    <main className="page-section">
      <section className="menu-shell">
        <div className="card menu-panel">
          <button type="button" className="menu-back-link" onClick={() => navigate('/home')}>
            <span aria-hidden="true">←</span>
            <span>Back to restaurant list</span>
          </button>
          <div className="menu-header">
            <p className="eyebrow">Menu</p>
            <h2>{restaurant.name}</h2>
            <p className="muted">{restaurant.cuisine} • {restaurant.eta}</p>
            <p className="info-subtext">{renderRestaurantAddress(restaurant)}</p>
          </div>

          <PickupTimeCard
            pickupAvailability={pickupAvailability}
            selectedMode={selectedPickupMode}
            scheduledPickupTime={scheduledPickupTime}
            onModeChange={handlePickupModeChange}
            onSelectPickupTime={setScheduledPickupTime}
            showTimeError={missingScheduledTime}
            asapReadyLabel={asapReadyLabel}
            earliestAvailableLabel={earliestAvailableLabel}
            scheduledPickupGroups={pickupSlotGroups}
          />

          <ReorderCard
            items={lastOrder?.items}
            hasOrder={Boolean(lastOrder?.items?.length)}
            onReorder={reorderLastOrder}
            onReorderItem={reorderSingleItem}
          />

          {hasMenuItems ? (
            <MenuList
              menu={menu}
              categories={categories}
              quantityById={quantityById}
              cartItemById={cartItemById}
              onAdd={addToCart}
              onUpdate={updateQuantity}
              onUpdateInstructions={updateInstructions}
            />
          ) : (
            <AsyncState
              title="No menu items available"
              message="This restaurant has not published any items yet."
              primaryActionLabel="Retry"
              onPrimaryAction={handleRetryMenu}
              secondaryActionLabel="Back to restaurant list"
              onSecondaryAction={() => navigate('/home')}
            />
          )}
        </div>

        <CartSummary
          cart={cart}
          total={total}
          totalItems={totalItems}
          pickupSummary={pickupSummary}
          paymentMessage="No online payment required"
          disabled={!cart.length || missingScheduledTime}
          orderError={orderError}
          onUpdateQuantity={updateQuantity}
          onPlaceOrder={handlePlaceOrder}
        />
      </section>

      {showPhoneModal ? (
        <PhoneModal
          customerPhone={customerPhoneInput}
          error={phoneValidationMessage || orderError}
          canSendCode={isCustomerPhoneValid}
          onClose={() => {
            setShowPhoneModal(false);
            setOrderError('');
          }}
          onCustomerPhoneChange={(value) => {
            setCustomerPhoneInput(value);
            if (orderError) {
              setOrderError('');
            }
          }}
          onSendOtp={handleSendOtp}
          phoneInputRef={phoneInputRef}
        />
      ) : null}
    </main>
  );
}

function buildCustomerOrderDraft({
  cart,
  cartItemById,
  customerName,
  customerPhone,
  restaurant,
  scheduledPickupTime,
  selectedPickupMode,
  total,
  pickupSummary,
  user,
}) {
  const orderItems = cart.map(({ id, name, price, quantity }) => ({
    id,
    name,
    price,
    quantity,
    lineTotal: price * quantity,
    specialInstructions: cartItemById[id]?.specialInstructions || '',
  }));
  const pickupTime =
    selectedPickupMode === PICKUP_MODES.SCHEDULED
      ? buildPickupTimestamp(scheduledPickupTime)
      : undefined;

  return {
    restaurantId: restaurant.id,
    restaurant,
    items: orderItems,
    subtotal: total,
    total,
    pickupRequest: {
      type: selectedPickupMode,
      scheduledTime: pickupTime,
      summary: pickupSummary,
    },
    customer: {
      name: customerName || getCustomerDisplayName(user) || '',
      phone: customerPhone,
      email: user?.email || '',
      pickupTime,
      notes: pickupSummary || '',
    },
    customerName: customerName || undefined,
  };
}

function resolvePickupAvailability(data, restaurant) {
  const source =
    data?.pickupAvailability ||
    restaurant?.pickupAvailability ||
    restaurant?.openHours ||
    restaurant?.open_hours ||
    null;

  const timezone = source?.timezone || restaurant?.timezone || defaultTimeZone();
  const weeklySchedule = normalizePickupWeeklySchedule(
    source?.weeklySchedule || source?.weekly_schedule || [],
  );
  const today = normalizePickupDay(source?.today || {}, weeklySchedule, timezone);

  return {
    timezone,
    asapAllowed: normalizeBoolean(source?.asapAllowed ?? restaurant?.asapAllowed, true),
    isOpenNow: normalizeBoolean(source?.isOpenNow ?? restaurant?.isOpenNow, false),
    statusMessage: source?.statusMessage || restaurant?.statusMessage || '',
    today,
    weeklySchedule,
  };
}

function normalizePickupWeeklySchedule(schedule = []) {
  if (!Array.isArray(schedule)) {
    return [];
  }

  return schedule
    .map((entry) => ({
      day: String(entry?.day || entry?.weekday || entry?.name || '').trim(),
      windows: normalizePickupWindows(entry?.windows || entry?.openHours || []).length
        ? normalizePickupWindows(entry?.windows || entry?.openHours || [])
        : createPickupWindow(entry?.openTime || entry?.open_time, entry?.closeTime || entry?.close_time),
    }))
    .filter((entry) => entry.day);
}

function normalizePickupDay(day = {}, weeklySchedule = [], timezone = '') {
  const windowsSource = normalizePickupWindows(day.windows || day.openHours || []);
  const windows = windowsSource.length
    ? windowsSource
    : createPickupWindow(day.openTime || day.open_time, day.closeTime || day.close_time);
  const fallbackWeekday = day.date ? formatWeekdayFromDate(day.date, timezone) : '';
  const weekday = String(day.weekday || day.day || fallbackWeekday || '').trim();
  const date = day.date ? String(day.date) : '';
  const scheduleEntry = weekday ? resolveWeeklyScheduleEntry(weeklySchedule, weekday) : null;
  const scheduleWindowsSource = normalizePickupWindows(scheduleEntry?.windows || scheduleEntry?.openHours || []);
  const mergedWindows = windows.length
    ? windows
    : scheduleWindowsSource.length
      ? scheduleWindowsSource
      : createPickupWindow(scheduleEntry?.openTime || scheduleEntry?.open_time, scheduleEntry?.closeTime || scheduleEntry?.close_time);

  return {
    date,
    weekday,
    openTime: day.openTime || day.open_time || mergedWindows[0]?.open || '',
    closeTime: day.closeTime || day.close_time || mergedWindows[mergedWindows.length - 1]?.close || '',
    windows: mergedWindows,
  };
}

function normalizePickupWindows(windows = []) {
  if (!Array.isArray(windows)) {
    return [];
  }

  return windows
    .map((window) => ({
      open: String(window?.open || window?.start || window?.from || '').trim(),
      close: String(window?.close || window?.end || window?.to || '').trim(),
    }))
    .filter((window) => window.open && window.close);
}

function createPickupWindow(open, close) {
  const normalizedOpen = String(open || '').trim();
  const normalizedClose = String(close || '').trim();
  if (!normalizedOpen || !normalizedClose) {
    return [];
  }

  return [{ open: normalizedOpen, close: normalizedClose }];
}

function resolveWeeklyScheduleEntry(weeklySchedule = [], weekday) {
  const target = normalizeWeekday(weekday);
  if (!target) {
    return null;
  }

  return weeklySchedule.find((entry) => normalizeWeekday(entry.day) === target) || null;
}

function normalizeWeekday(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function buildPickupSlotGroups(availability) {
  if (!availability) {
    return [];
  }

  const groups = [];
  for (let offset = 0; offset < PICKUP_SLOT_LOOKAHEAD_DAYS; offset += 1) {
    const candidateDate = new Date(Date.now() + offset * 86400000);
    const dayParts = getDatePartsInTimeZone(candidateDate, availability.timezone);
    const scheduleEntry = offset === 0 ? availability.today : resolveWeeklyScheduleEntry(availability.weeklySchedule, dayParts.weekday);
    const windows = normalizePickupWindows(scheduleEntry?.windows);
    if (!windows.length) {
      continue;
    }

    const slots = windows.flatMap((window) => buildPickupSlotsForWindow(dayParts, window, availability.timezone));
    if (!slots.length) {
      continue;
    }

    groups.push({
      key: `${dayParts.year}-${dayParts.month}-${dayParts.day}`,
      label: formatPickupDayLabel(candidateDate, availability.timezone, offset),
      hoursLabel: formatPickupWindows(windows, availability.timezone),
      slots,
    });
  }

  return groups;
}

function buildPickupSlotsForWindow(dayParts, window, timezone) {
  const openMinutes = parseTimeToMinutes(window.open);
  const closeMinutes = parseTimeToMinutes(window.close);
  if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes) || closeMinutes <= openMinutes) {
    return [];
  }

  const slots = [];
  const start = Math.ceil(openMinutes / PICKUP_SLOT_STEP_MINUTES) * PICKUP_SLOT_STEP_MINUTES;
  const end = Math.floor(closeMinutes / PICKUP_SLOT_STEP_MINUTES) * PICKUP_SLOT_STEP_MINUTES;

  for (let minutes = start; minutes <= end; minutes += PICKUP_SLOT_STEP_MINUTES) {
    const slotDate = buildDateInTimeZone(dayParts, minutes, timezone);
    slots.push({
      value: slotDate.toISOString(),
      label: formatPickupTimeLabel(slotDate, timezone),
      windowLabel: `${formatTimeRange(window.open, window.close, timezone)}`,
    });
  }

  return slots;
}

function isPickupSelectionInGroups(value, groups = []) {
  return groups.some((group) => group.slots.some((slot) => slot.value === value));
}

function normalizeScheduledPickupSelection(value, availability) {
  const input = String(value || '').trim();
  if (!input) {
    return '';
  }

  if (input.includes('T')) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  const parsed = parseTimeToMinutes(input);
  if (!Number.isFinite(parsed)) {
    return '';
  }

  const sourceDay = availability?.today?.date || '';
  const sourceParts = sourceDay
    ? getDatePartsInTimeZone(new Date(sourceDay), availability.timezone)
    : getDatePartsInTimeZone(new Date(), availability?.timezone || defaultTimeZone());
  return buildDateInTimeZone(sourceParts, parsed, availability?.timezone || defaultTimeZone()).toISOString();
}

function buildDateInTimeZone(dayParts, minutes, timezone) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const target = {
    year: dayParts.year,
    month: dayParts.month,
    day: dayParts.day,
    hour: hours,
    minute: mins,
  };

  let guess = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const current = getDatePartsInTimeZone(new Date(guess), timezone);
    if (
      current.year === target.year &&
      current.month === target.month &&
      current.day === target.day &&
      current.hour === target.hour &&
      current.minute === target.minute
    ) {
      return new Date(guess);
    }

    const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
    const currentAsUtc = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute);
    guess += targetAsUtc - currentAsUtc;
  }

  return new Date(guess);
}

function getDatePartsInTimeZone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || defaultTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'long',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    weekday: parts.find((part) => part.type === 'weekday')?.value || '',
  };
}

function formatPickupDayLabel(date, timezone, offset) {
  if (offset === 0) {
    return 'Today';
  }
  if (offset === 1) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone || defaultTimeZone(),
  });
}

function formatPickupTimeLabel(date, timezone) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || defaultTimeZone(),
  });
}

function formatWeekdayFromDate(value, timezone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString([], {
    weekday: 'long',
    timeZone: timezone || defaultTimeZone(),
  });
}

function formatPickupWindows(windows = [], timezone) {
  const normalized = normalizePickupWindows(windows);
  if (!normalized.length) {
    return '';
  }

  return normalized
    .map((window) => `${formatTimeRange(window.open, window.close, timezone)}`)
    .join(' • ');
}

function formatTimeRange(open, close, timezone) {
  const openDate = buildTimeForFormatting(open, timezone);
  const closeDate = buildTimeForFormatting(close, timezone);
  return `${formatPickupTimeLabel(openDate, timezone)} - ${formatPickupTimeLabel(closeDate, timezone)}`;
}

function buildTimeForFormatting(time, timezone) {
  const minutes = parseTimeToMinutes(time);
  const baseParts = getDatePartsInTimeZone(new Date(), timezone || defaultTimeZone());
  return buildDateInTimeZone(baseParts, minutes, timezone || defaultTimeZone());
}

function parseTimeToMinutes(timeValue) {
  const input = String(timeValue || '').trim();
  if (!input) {
    return NaN;
  }

  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return NaN;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return NaN;
  }

  return hours * 60 + minutes;
}

function defaultTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function renderRestaurantAddress(restaurant) {
  const { line1, secondary } = getRestaurantAddressLines(restaurant);
  return (
    <span className="menu-address-line">
      <span className="menu-address-line__pin" aria-hidden="true">
        📍
      </span>
      <span>{[line1, secondary].filter(Boolean).join(', ')}</span>
    </span>
  );
}

// Segmented pickup card keeps pickup choice visible for quick adjustments.
function PickupTimeCard({
  pickupAvailability,
  selectedMode,
  scheduledPickupTime,
  onModeChange,
  onSelectPickupTime,
  showTimeError,
  asapReadyLabel,
  earliestAvailableLabel,
  scheduledPickupGroups,
}) {
  const isScheduled = selectedMode === PICKUP_MODES.SCHEDULED;
  const scheduledTimeHelperId = 'scheduled-time-helper';
  const helperMessage = showTimeError
    ? 'Select a pickup time to continue'
    : earliestAvailableLabel || 'Earliest available: Soon';
  const isOpenNow = Boolean(pickupAvailability?.isOpenNow);
  const asapAllowed = pickupAvailability?.asapAllowed !== false;
  const timezone = pickupAvailability?.timezone || '';
  const todayWindows = pickupAvailability?.today?.windows || [];
  const statusMessage =
    pickupAvailability?.statusMessage ||
    (isOpenNow
      ? 'The restaurant is open right now.'
      : 'Currently the restaurant is closed, but you can still place an order for later pickup.');
  const todayHoursLabel = formatPickupWindows(todayWindows, timezone) || 'Pickup hours not available yet';

  return (
    <section className="pickup-card" aria-labelledby="pickup-card-title">
      <div className="card-heading">
        <p className="eyebrow">Pickup time</p>
        <h3>Choose how you want to pick up your order</h3>
      </div>
      <div className={`pickup-availability${isOpenNow ? ' pickup-availability--open' : ' pickup-availability--closed'}`}>
        <div className="pickup-availability__status">
          <span className={`pickup-status-badge${isOpenNow ? ' is-open' : ' is-closed'}`}>
            {isOpenNow ? 'Open now' : 'Closed now'}
          </span>
          <p className="pickup-availability__message">{statusMessage}</p>
        </div>
        <div className="pickup-availability__hours">
          <strong>Today</strong>
          <p>{todayHoursLabel}</p>
          {timezone ? <span className="muted">Timezone: {timezone}</span> : null}
        </div>
      </div>
      <div className="pickup-tabs" role="tablist" aria-label="Pickup options">
        {[PICKUP_MODES.ASAP, PICKUP_MODES.SCHEDULED].map((mode) => {
          const isActive = selectedMode === mode;
          const label = mode === PICKUP_MODES.ASAP ? 'ASAP' : 'Schedule for Later';
          const disabled = mode === PICKUP_MODES.ASAP && !asapAllowed;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`pickup-tab${isActive ? ' active' : ''}${disabled ? ' is-disabled' : ''}`}
              onClick={() => {
                if (!disabled) {
                  onModeChange(mode);
                }
              }}
              disabled={disabled}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="pickup-details">
        {isScheduled ? (
          <div className="scheduled-picker">
            <div className="scheduled-picker__header">
              <strong>Available pickup times</strong>
              <span className="muted">Only times within open hours are shown.</span>
            </div>
            {scheduledPickupGroups.length ? (
              <div className="pickup-slot-groups">
                {scheduledPickupGroups.map((group) => (
                  <section className="pickup-slot-group" key={group.key}>
                    <div className="pickup-slot-group__header">
                      <strong>{group.label}</strong>
                      <span className="muted">{group.hoursLabel}</span>
                    </div>
                    <div className="pickup-slot-grid" role="list" aria-label={`${group.label} pickup times`}>
                      {group.slots.map((slot) => {
                        const isSelected = scheduledPickupTime === slot.value;
                        return (
                          <button
                            key={slot.value}
                            type="button"
                            className={`pickup-slot${isSelected ? ' active' : ''}`}
                            aria-pressed={isSelected}
                            onClick={() => onSelectPickupTime(slot.value)}
                          >
                            <span>{slot.label}</span>
                            {slot.windowLabel ? <small>{slot.windowLabel}</small> : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="pickup-slot-empty">
                <p className="muted">No pickup times are available right now.</p>
                <p id={scheduledTimeHelperId} className={showTimeError ? 'error-text' : 'muted'}>
                  {helperMessage}
                </p>
              </div>
            )}
            {scheduledPickupTime ? (
              <p className="pickup-slot-selection">
                Selected: <strong>{formatScheduledPickupSelection(scheduledPickupTime, timezone)}</strong>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="asap-preview" aria-live="polite">
            <p className="pickup-window">{asapReadyLabel}</p>
            {!asapAllowed ? (
              <p className="muted pickup-helper">ASAP pickup is currently unavailable.</p>
            ) : earliestAvailableLabel ? (
              <p className="muted pickup-helper">{earliestAvailableLabel}</p>
            ) : null}
            {!isOpenNow ? (
              <p className="muted pickup-helper">
                Currently the restaurant is closed, but you can still place an order for later pickup.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

// Compact reorder card keeps the last order handy without overpowering the menu.
function ReorderCard({ items = [], hasOrder, onReorder, onReorderItem }) {
  const previewItems = (items || []).slice(0, 3);
  return (
    <section className="reorder-card" aria-live="polite">
      <div>
        <p className="eyebrow">Reorder</p>
        <h3>Reorder your last order</h3>
        {hasOrder ? (
          <ul className="reorder-items">
            {previewItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="reorder-item-button"
                  onClick={() => onReorderItem?.(item)}
                  aria-label={`Reorder ${item.name}`}
                >
                  <span className="reorder-item-icon" aria-hidden="true">
                    {getItemBadgeLabel(item.name)}
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <span className="muted">
                      {item.quantity} × {formatCurrency(item.price)}
                    </span>
                  </div>
                  <span className="reorder-item-button__plus" aria-hidden="true">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No recent order found. Reorder will be enabled after you place a previous order here.</p>
        )}
      </div>
      <div className="reorder-card__footer">
        <p className="muted reorder-card__helper">
          {hasOrder ? 'Tap an item or use Reorder to add your last order again.' : 'No recent order found.'}
        </p>
        <button type="button" className="reorder-card__button" onClick={onReorder} disabled={!hasOrder}>
          Reorder
        </button>
      </div>
    </section>
  );
}

// Menu list stays lean so the cart retains secondary visual weight.
function MenuList({ menu, categories, quantityById, cartItemById, onAdd, onUpdate, onUpdateInstructions }) {
  const [expandedItemId, setExpandedItemId] = useState(null);
  const groupedMenu = useMemo(() => groupMenuItems(menu, categories), [menu, categories]);
  const visibleCategoryGroups = useMemo(() => groupedMenu.filter((group) => group.key !== 'uncategorized'), [groupedMenu]);
  const [activeCategory, setActiveCategory] = useState('');
  const displayedGroups = useMemo(() => {
    if (activeCategory) {
      const selectedGroup = groupedMenu.filter((group) => group.key === activeCategory);
      return selectedGroup.length > 0 ? selectedGroup : groupedMenu;
    }

    if (visibleCategoryGroups.length > 0) {
      return groupedMenu.filter((group) => group.key === visibleCategoryGroups[0].key);
    }

    return groupedMenu;
  }, [activeCategory, groupedMenu]);

  useEffect(() => {
    if (expandedItemId && !quantityById[expandedItemId]) {
      setExpandedItemId(null);
    }
  }, [expandedItemId, quantityById]);

  useEffect(() => {
    if (!visibleCategoryGroups.length) {
      setActiveCategory('');
      return;
    }

    setActiveCategory((current) => {
      const stillExists = visibleCategoryGroups.some((group) => group.key === current);
      return stillExists ? current : visibleCategoryGroups[0].key;
    });
  }, [visibleCategoryGroups]);

  useEffect(() => {
    if (!activeCategory) {
      return;
    }

    const target = document.getElementById(activeCategory);
    if (!target) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const offset = Math.max(12, target.getBoundingClientRect().top + window.scrollY - 88);
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeCategory, displayedGroups]);

  if (!menu.length) {
    return null;
  }

  return (
    <div className="menu-catalog" aria-live="polite">
      {visibleCategoryGroups.length > 1 ? (
        <div className="menu-catalog__tabs" role="tablist" aria-label="Menu categories">
          {visibleCategoryGroups.map((group) => (
              <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={activeCategory === group.key}
              className={`menu-category-chip${activeCategory === group.key ? ' active' : ''}`}
              onClick={() => {
                setActiveCategory(group.key);
              }}
            >
              {group.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="menu-catalog__groups">
        {displayedGroups.map((group) => (
          <section className="menu-category-section" id={group.key} key={group.key}>
            {group.key === 'uncategorized' ? null : (
              <h2 className="menu-category-section__title">
                {group.title}
                <span className="menu-category-section__count">({group.items.length} Items)</span>
              </h2>
            )}
            <div className="menu-grid">
              {group.items.map((item, index) => {
                const menuItemIdentity = resolveMenuItemIdentity(item, index);
                return (
                  <MenuItemCard
                    key={menuItemIdentity}
                    item={item}
                    itemId={menuItemIdentity}
                    categoryLabel={group.category?.name || ''}
                    quantity={quantityById[menuItemIdentity] || 0}
                    instructions={cartItemById[menuItemIdentity]?.specialInstructions || ''}
                    isInstructionsExpanded={expandedItemId === menuItemIdentity}
                    isBestseller={Boolean(item.isBestseller || item.is_bestseller || item.badge || (index === 0 && group.key === groupedMenu[0]?.key))}
                    onAdd={onAdd}
                    onUpdate={onUpdate}
                    onToggleInstructions={() => {
                      setExpandedItemId((current) => (current === menuItemIdentity ? null : menuItemIdentity));
                    }}
                    onUpdateInstructions={onUpdateInstructions}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MenuItemCard({
  item,
  itemId,
  categoryLabel,
  quantity,
  instructions,
  isInstructionsExpanded,
  isBestseller,
  onAdd,
  onUpdate,
  onToggleInstructions,
  onUpdateInstructions,
}) {
  return (
    <article className={`menu-item-card${quantity > 0 ? ' menu-item-card--selected' : ''}`}>
      <div className="menu-item-card__top">
        <div className="menu-item-card__copy">
          <div className="menu-item-card__title-row">
            <strong className="menu-item-card__title">{item.name}</strong>
            <span className="menu-item-card__price">{formatCurrency(item.price)}</span>
          </div>
          {(categoryLabel || item.description) ? (
            <p className="menu-item-card__meta">
              {categoryLabel ? <span className="menu-item-card__meta-category">{categoryLabel}</span> : null}
              {categoryLabel && item.description ? <span className="menu-item-card__meta-separator">•</span> : null}
              {item.description ? <span className="menu-item-card__meta-description">{item.description}</span> : null}
            </p>
          ) : null}
          <div className="menu-item-card__badges">
            {normalizeBoolean(item.isAvailable ?? item.is_available ?? true) ? (
              <span className="menu-item-card__status menu-item-card__status--available">ON</span>
            ) : null}
            {normalizeBoolean(item.isVegetarian ?? item.is_vegetarian ?? item.isVegan ?? item.is_vegan, false) ? (
              <span className="menu-item-card__status menu-item-card__status--vegetarian">VEGETARIAN</span>
            ) : null}
            {isBestseller ? <span className="menu-item-card__status menu-item-card__status--featured">Bestseller</span> : null}
          </div>
        </div>

        <div className="menu-item-card__action">
          {quantity > 0 ? (
            <div className="menu-stepper">
              <button
                type="button"
                className="menu-stepper__btn"
                aria-label={`Decrease ${item.name}`}
                onClick={() => onUpdate(itemId, quantity - 1)}
              >
                -
              </button>
              <span className="menu-stepper__count">{quantity}</span>
              <button
                type="button"
                className="menu-stepper__btn menu-stepper__btn--add"
                aria-label={`Increase ${item.name}`}
                onClick={() => onUpdate(itemId, quantity + 1)}
              >
                +
              </button>
            </div>
          ) : (
            <button type="button" className="menu-add-btn" onClick={() => onAdd(item)}>
              Add
            </button>
          )}
        </div>
      </div>

      {quantity > 0 ? (
        <div className="menu-item-card__instructions">
          <button type="button" className="menu-instructions-toggle" onClick={onToggleInstructions}>
            {isInstructionsExpanded ? (
              'Hide Instructions'
            ) : (
              <>
                <span>Add Instructions</span>
                <span className="menu-instructions-toggle__hint">Optional</span>
              </>
            )}
          </button>
          {isInstructionsExpanded ? (
            <div className="menu-instructions-editor">
              <textarea
                rows="2"
                value={instructions}
                onChange={(event) => onUpdateInstructions(itemId, event.target.value)}
                placeholder="Add a note for the kitchen"
              />
              <p className="muted menu-instructions-help">Example: less spicy, no onions, sauce on the side</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function groupMenuItems(menu = [], categories = []) {
  const groups = new Map();
  const orderedKeys = [];
  const normalizedCategories = normalizeMenuCategories(categories);
  const seenMenuItemIds = new Set();

  normalizedCategories.forEach((category, index) => {
    const key = getCategoryGroupKey(category);
    const categoryItems = Array.isArray(category.items) ? category.items : [];
    groups.set(key, {
      key,
      title: category.name,
      order: normalizeNumber(category.displayOrder, index + 1),
      items: categoryItems.map((item, itemIndex) => ({
        ...item,
        __menuIndex: itemIndex,
      })),
      category,
    });
    categoryItems.forEach((item) => {
      if (item?.id !== undefined && item?.id !== null) {
        seenMenuItemIds.add(String(item.id));
      }
    });
    orderedKeys.push(key);
  });

  const uncategorized = {
    key: 'uncategorized',
    title: 'All Items',
    order: Number.MAX_SAFE_INTEGER,
    items: [],
    category: null,
  };

  menu.forEach((item, index) => {
    if (item?.id !== undefined && item?.id !== null && seenMenuItemIds.has(String(item.id))) {
      return;
    }

    const descriptor = getMenuItemCategoryDescriptor(item);
    const matchedGroup = resolveMenuItemCategory(item, normalizedCategories);

    if (matchedGroup) {
      const key = getCategoryGroupKey(matchedGroup);
      groups.get(key)?.items.push({ ...item, __menuIndex: index });
      if (item?.id !== undefined && item?.id !== null) {
        seenMenuItemIds.add(String(item.id));
      }
      return;
    }

    if (descriptor) {
      const key = getCategoryGroupKey(descriptor);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: descriptor.name,
          order: orderedKeys.length + 1,
          items: [],
          category: {
            id: descriptor.id || descriptor.name,
            name: descriptor.name,
            displayOrder: orderedKeys.length + 1,
            isActive: true,
          },
        });
        orderedKeys.push(key);
      }

      groups.get(key)?.items.push({
        ...item,
        __menuIndex: index,
      });
      if (item?.id !== undefined && item?.id !== null) {
        seenMenuItemIds.add(String(item.id));
      }
      return;
    }

    uncategorized.items.push({
      ...item,
      __menuIndex: index,
    });
  });

  if (uncategorized.items.length > 0) {
    groups.set(uncategorized.key, uncategorized);
    orderedKeys.push(uncategorized.key);
  }

  return orderedKeys
    .map((key) => groups.get(key))
    .filter(Boolean)
    .map((group) => ({
      ...group,
      items: sortMenuItems(group.items),
    }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.title.localeCompare(b.title);
    });
}

function normalizeMenuCategories(categories = []) {
  return categories
    .map((category, index) => ({
      ...category,
      id: category.id,
      name: category.name || category.title || `Category ${index + 1}`,
      displayOrder: normalizeNumber(category.display_order ?? category.displayOrder, index + 1),
      isActive: category.is_active ?? category.isActive ?? true,
    }))
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });
}

function normalizeBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'available', 'active', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'unavailable', 'inactive', 'off'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function getMenuItemCategoryDescriptor(item = {}) {
  const categoryId =
    item.categoryId ??
    item.category_id ??
    item.category?.id ??
    item.category?.categoryId ??
    item.category?.category_id ??
    '';
  const categoryName =
    item.categoryName ??
    item.category_name ??
    item.categoryLabel ??
    item.category_label ??
    item.categoryTitle ??
    item.category_title ??
    item.menuCategoryName ??
    item.menu_category_name ??
    item.menuCategory ??
    item.menu_category ??
    item.category?.name ??
    item.category?.title ??
    item.category?.label ??
    item.category?.categoryName ??
    item.category?.category_name ??
    item.category ??
    item.section ??
    item.group ??
    '';

  if (!categoryId && !categoryName) {
    return null;
  }

  return {
    id: categoryId || categoryName,
    name: categoryName || String(categoryId),
  };
}

function resolveMenuItemCategory(item, categories = []) {
  const categoryId =
    item.categoryId ??
    item.category_id ??
    item.category?.id ??
    item.category?.categoryId ??
    item.category?.category_id ??
    '';
  const categoryName =
    item.categoryName ??
    item.category_name ??
    item.categoryLabel ??
    item.category_label ??
    item.categoryTitle ??
    item.category_title ??
    item.menuCategoryName ??
    item.menu_category_name ??
    item.menuCategory ??
    item.menu_category ??
    item.category?.name ??
    item.category?.title ??
    item.category?.label ??
    item.category?.categoryName ??
    item.category?.category_name ??
    item.category ??
    item.section ??
    item.group ??
    '';

  if (categoryId) {
    const byId = categories.find((category) => String(category.id) === String(categoryId));
    if (byId) {
      return byId;
    }
  }

  if (categoryName) {
    const normalizedName = String(categoryName).trim().toLowerCase();
    const byName = categories.find((category) => String(category.name).trim().toLowerCase() === normalizedName);
    if (byName) {
      return byName;
    }
  }

  return null;
}

function getCategoryGroupKey(category) {
  return `category:${String(category.id ?? category.name).trim().toLowerCase()}`;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveMenuItemIdentity(item = {}, fallbackIndex = 0) {
  const directKeys = [
    item.id,
    item.menuItemId,
    item.menu_item_id,
    item.menuItemID,
    item.menu_itemID,
    item.sku,
    item.code,
    item._id,
  ];

  const directMatch = directKeys.find((value) => value !== undefined && value !== null && String(value).trim());
  if (directMatch !== undefined && directMatch !== null && String(directMatch).trim()) {
    return String(directMatch).trim();
  }

  const name = String(item.name || item.title || item.label || '').trim();
  if (name) {
    return `${name.toLowerCase()}-${fallbackIndex}`;
  }

  return `item-${fallbackIndex}`;
}

function sortMenuItems(items = []) {
  return [...items].sort((a, b) => {
    const aOrder = Number.isFinite(a.displayOrder) ? a.displayOrder : Number(a.__menuIndex || 0);
    const bOrder = Number.isFinite(b.displayOrder) ? b.displayOrder : Number(b.__menuIndex || 0);
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.name.localeCompare(b.name);
  });
}

// Cart summary mirrors pickup choice and keeps the place order action focused.
function CartSummary({
  cart,
  total,
  totalItems,
  pickupSummary,
  paymentMessage,
  submitting,
  orderError,
  disabled,
  onUpdateQuantity,
  onPlaceOrder,
}) {
  const grandTotal = total;
  const isCartEmpty = cart.length === 0;

  return (
    <aside className="card cart-panel cart-summary cart-wireframe">
      <div className="cart-header">
        <div>
          <p className="eyebrow">Pickup</p>
          <h3>{pickupSummary}</h3>
        </div>
        <div className="cart-total">
          <p className="eyebrow">Cart</p>
          <strong>{formatCurrency(grandTotal)}</strong>
          <span className="muted">{totalItems || 0} items</span>
        </div>
      </div>

      {isCartEmpty && (
        <div className="empty-cart">
          <strong>Your cart is empty</strong>
          <span>Add items to get started</span>
        </div>
      )}

      {!isCartEmpty && (
        <>
          <ul className="cart-preview-items">
            {cart.map((cartItem) => (
              <li key={cartItem.id}>
                <div className="cart-item-details">
                  <div className="cart-item-details__top">
                    <strong>{cartItem.name}</strong>
                    <strong>{formatCurrency(cartItem.price * cartItem.quantity)}</strong>
                  </div>
                  <div className="cart-item-stepper">
                    <button
                      type="button"
                      className="cart-stepper-btn"
                      aria-label={`Decrease ${cartItem.name}`}
                      onClick={() => onUpdateQuantity(cartItem.id, cartItem.quantity - 1)}
                    >
                      -
                    </button>
                    <span className="cart-stepper-count">{cartItem.quantity}</span>
                    <button
                      type="button"
                      className="cart-stepper-btn cart-stepper-btn--add"
                      aria-label={`Increase ${cartItem.name}`}
                      onClick={() => onUpdateQuantity(cartItem.id, cartItem.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="cart-divider" aria-hidden="true" />

          <div className="cart-preview-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <div className="cart-preview-totals-grand">
              <span>Total</span>
              <strong>{formatCurrency(grandTotal)}</strong>
            </div>
          </div>
        </>
      )}

      <div className="cart-payment-callout">
        <span aria-hidden="true">💰</span>
        <div>
          <strong>Pay at restaurant</strong>
          <p className="muted">{paymentMessage}</p>
        </div>
      </div>

      {orderError && <p className="error-text">{orderError}</p>}

      <button className="primary-btn cart-preview-cta" type="button" disabled={disabled || submitting} onClick={onPlaceOrder}>
        {submitting ? 'Placing order…' : 'Place Order'}
      </button>
    </aside>
  );
}

function PhoneModal({
  customerPhone,
  error,
  canSendCode,
  onClose,
  onCustomerPhoneChange,
  onSendOtp,
  phoneInputRef,
}) {
  return (
    <div className="phone-modal-backdrop" role="presentation">
      <section
        className="phone-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="phone-modal__close" onClick={onClose} aria-label="Close phone modal">
          ×
        </button>
        <div className="phone-modal__icon" aria-hidden="true">
          <LockIcon />
        </div>
        <p className="phone-modal__eyebrow">Verify your phone</p>
        <h2 id="phone-modal-title">We&apos;ll send a 6-digit code to confirm your order and share pickup updates</h2>
        <label className="phone-modal__field">
          <span>Phone number</span>
          <div className="phone-modal__input-shell">
            <span className="phone-modal__country" aria-hidden="true">🇺🇸</span>
            <input
              ref={phoneInputRef}
              type="tel"
              value={customerPhone}
              onChange={(event) => onCustomerPhoneChange(event.target.value)}
              placeholder="+1 555 123 4567"
              autoComplete="tel"
            />
          </div>
        </label>
        {error ? <p className="error-text phone-modal__error">{error}</p> : null}
        <button
          type="button"
          className={`phone-modal__submit${canSendCode ? '' : ' is-disabled'}`}
          onClick={onSendOtp}
          disabled={!canSendCode}
        >
          Send Code
        </button>
        <p className="phone-modal__legal">
          By continuing, you agree to receive a one-time SMS for order verification. Message and data rates may apply.
        </p>
        <p className="phone-modal__helper">
          <span aria-hidden="true">✓</span>
          <span>Used only for order updates</span>
        </p>
      </section>
    </div>
  );
}

function normalizeUSPhoneNumber(value) {
  const input = String(value || '').trim();
  if (!input) {
    return '';
  }

  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return '';
}

function buildPickupTimestamp(timeValue) {
  const input = String(timeValue || '').trim();
  if (!input) {
    return '';
  }

  const [hourString, minuteString] = input.split(':');
  const hours = Number(hourString);
  const minutes = Number(minuteString);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function getPickupSummary(mode, scheduledTime, asapReadyTime, pickupAvailability) {
  if (mode === PICKUP_MODES.SCHEDULED) {
    return scheduledTime
      ? `Scheduled for ${formatScheduledPickupSelection(scheduledTime, pickupAvailability?.timezone)}`
      : 'Choose a pickup time';
  }
  return getAsapReadyLabel(asapReadyTime, pickupAvailability);
}

function formatScheduledPickupSelection(value, timezone) {
  if (!value) {
    return '';
  }

  if (String(value).includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone || defaultTimeZone(),
      });
    }
  }

  const minutes = parseTimeToMinutes(value);
  if (!Number.isFinite(minutes)) {
    return String(value);
  }

  const baseParts = getDatePartsInTimeZone(new Date(), timezone || defaultTimeZone());
  const date = buildDateInTimeZone(baseParts, minutes, timezone || defaultTimeZone());
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || defaultTimeZone(),
  });
}

function formatTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const [hourString, minuteString] = String(value).split(':');
  const hours = Number(hourString);
  const period = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${normalizedHours}:${minuteString} ${period}`;
}

function getTimeFromNow(minutesAhead) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutesAhead);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getAsapReadyLabel(value, pickupAvailability) {
  if (pickupAvailability && pickupAvailability.isOpenNow === false && pickupAvailability.asapAllowed) {
    return 'Currently the restaurant is closed, but you can still place an order for later pickup.';
  }

  if (pickupAvailability && pickupAvailability.asapAllowed === false) {
    return 'ASAP pickup is currently unavailable.';
  }

  return value ? `Pickup at ~${formatTime(value)} (15–20 min)` : 'Pickup in ~15–20 min';
}

function getEarliestAvailableLabel(value) {
  return value ? `Earliest available: ${formatTime(value)}` : '';
}

function getLastOrderFromHistory(orders = [], restaurantId) {
  if (!restaurantId || !Array.isArray(orders) || !orders.length) {
    return null;
  }

  const latestOrder = [...orders]
    .filter((order) => matchesRestaurantId(order, restaurantId))
    .sort((a, b) => getOrderTimeValue(b) - getOrderTimeValue(a))[0];

  if (!latestOrder) {
    return null;
  }

  const items = normalizeOrderItems(latestOrder);
  if (!items.length) {
    return null;
  }

  return {
    id: latestOrder.id || latestOrder.orderNumber || null,
    items,
    summary: items.map((item) => `${item.quantity}× ${item.name}`).join(', '),
  };
}

function matchesRestaurantId(order, restaurantId) {
  const orderRestaurantId =
    order?.restaurantId ||
    order?.restaurant?.id ||
    order?.restaurant_id ||
    order?.restaurant?.restaurantId ||
    order?.restaurant?.restaurant_id ||
    '';

  return String(orderRestaurantId).trim() === String(restaurantId).trim();
}

function normalizeOrderItems(order) {
  const rawItems =
    order?.items ||
    order?.orderItems ||
    order?.order_items ||
    order?.lineItems ||
    order?.line_items ||
    [];

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map((item) => ({
      ...item,
      id: item?.id || item?.menuItemId || item?.menu_item_id || item?.sku || item?.name,
      name: item?.name || item?.title || item?.label || 'Item',
      price: Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0),
      quantity: Number(item?.quantity || 1),
    }))
    .filter((item) => item.id && item.name);
}

function getOrderTimeValue(order) {
  const raw =
    order?.created_at ||
    order?.createdAt ||
    order?.placedAt ||
    order?.orderedAt ||
    order?.submittedAt ||
    order?.updatedAt ||
    order?.updated_at ||
    0;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 3a1.5 1.5 0 0 1 .75 2.8V18h-1.5v-2.2A1.5 1.5 0 0 1 12 13Z" />
    </svg>
  );
}

function getItemBadgeLabel(name) {
  return name?.charAt(0)?.toUpperCase() || '✦';
}

function getCustomerDisplayName(entity) {
  if (!entity) {
    return '';
  }
  const directFields = [
    entity.preferredName,
    entity.preferred_name,
    entity.firstName,
    entity.first_name,
    entity.fullName,
    entity.full_name,
    entity.name,
    entity.displayName,
    entity.display_name,
  ];
  const match = directFields.find((field) => typeof field === 'string' && field.trim());
  if (match) {
    return match.trim();
  }
  const composite =
    [entity.firstName || entity.first_name, entity.lastName || entity.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
  if (composite) {
    return composite;
  }
  if (entity.profile) {
    return getCustomerDisplayName(entity.profile);
  }
  return '';
}
