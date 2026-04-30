import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { fetchRestaurantMenu } from '../api/restaurantsApi.js';
import { fetchCustomerOrders } from '../api/customersApi.js';
import { validatePromotion } from '../api/promotionsApi.js';
import AsyncState from '../components/shared/AsyncState.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { resolveMoneyDisplay } from '../utils/orderMoney.js';
import { getRestaurantAddressLines } from '../utils/formatRestaurantAddress.js';
import { getRestaurantMenuPath, matchesRestaurantRouteKey, resolveRestaurantRouteKey } from '../utils/restaurantRoutes.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { buildCustomerLoginState, getCustomerHomePath } from '../utils/customerFlow.js';
import { resolvePromoValidationMessage } from '../utils/promoMessages.js';
import { submitOrder } from '../api/ordersApi.js';
import {
  clearCustomerOrderVerification,
  clearCustomerOrderDraft,
  getCustomerOrderDraft,
  getVerifiedCustomerPhone,
  storeCustomerOrderDraft,
} from '../services/authStorage.js';
import { getCustomerId, getCustomerPhone } from '../utils/customerIdentity.js';

const PICKUP_MODES = {
  ASAP: 'ASAP',
  SCHEDULED: 'SCHEDULED',
};
const PICKUP_WINDOW_MINUTES = 20;
const EARLIEST_PICKUP_MINUTES = 15;
const PICKUP_SLOT_STEP_MINUTES = 15;
const PICKUP_SLOT_LOOKAHEAD_DAYS = 14;

export default function RestaurantMenuPage() {
  const { restaurantId, restaurantRouteKey } = useParams();
  const navigate = useNavigate();
  const { user, canAccessCustomerFlow, loading: authLoading } = useAuth();
  const routeKey = restaurantRouteKey || restaurantId || '';
  const customerName = useMemo(() => getCustomerDisplayName(user), [user]);
  const customerId = useMemo(() => getCustomerId(user), [user]);
  const initialCustomerPhone = useMemo(() => getCustomerPhone(user) || getVerifiedCustomerPhone() || '', [user]);
  const [cart, setCart] = useState([]);
  const [selectedPickupMode, setSelectedPickupMode] = useState(PICKUP_MODES.ASAP);
  const [scheduledPickupTime, setScheduledPickupTime] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledPickupDraftDateKey, setScheduledPickupDraftDateKey] = useState('');
  const [scheduledPickupDraftTime, setScheduledPickupDraftTime] = useState('');
  const [orderError, setOrderError] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState(initialCustomerPhone);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [pendingPromoCode, setPendingPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSubmitting, setPromoSubmitting] = useState(false);
  const [showManualPromoInput, setShowManualPromoInput] = useState(false);
  const [smsConsentAccepted, setSmsConsentAccepted] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [continuingOrder, setContinuingOrder] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const phoneInputRef = useRef(null);
  const { data, loading, error, errorInfo } = useFetch(
    () => fetchRestaurantMenu(routeKey),
    [routeKey, retryKey],
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
  const canBrowseMenu = canAccessCustomerFlow;

  useEffect(() => {
    const storedDraft = getCustomerOrderDraft();
    const currentRestaurantKey = data?.restaurant?.id || routeKey;
    const restaurantKeys = [currentRestaurantKey, routeKey].filter(Boolean);
    const matchesRestaurant = restaurantKeys.some(
      (key) =>
        matchesRestaurantRouteKey(storedDraft?.restaurantRouteKey, key) ||
        matchesRestaurantRouteKey(storedDraft?.restaurant, key) ||
        matchesRestaurantRouteKey(storedDraft?.restaurantId, key),
    );

    if (matchesRestaurant) {
      setCart(Array.isArray(storedDraft.items) ? storedDraft.items.map((item) => ({ ...item })) : []);
      setSelectedPickupMode(storedDraft?.pickupRequest?.type === PICKUP_MODES.SCHEDULED ? PICKUP_MODES.SCHEDULED : PICKUP_MODES.ASAP);
      setScheduledPickupTime(storedDraft?.pickupRequest?.scheduledTime || '');
      setCustomerPhoneInput(
        storedDraft?.customer?.phone ||
          storedDraft?.customerPhone ||
          getCustomerPhone(user) ||
          getVerifiedCustomerPhone() ||
          initialCustomerPhone,
      );
      setPromoCodeInput(storedDraft?.promoCodeInput || storedDraft?.pendingPromoCode || storedDraft?.promoCode || '');
      setPendingPromoCode(storedDraft?.pendingPromoCode || '');
      setAppliedPromo(storedDraft?.appliedPromo || null);
      setDiscountAmount(Number(storedDraft?.appliedPromo?.discountAmount ?? 0) || 0);
      setFinalAmount(Number(storedDraft?.appliedPromo?.finalAmount ?? storedDraft?.subtotal ?? 0) || 0);
      setPromoMessage(
        storedDraft?.appliedPromo?.valid
          ? `${storedDraft.appliedPromo.promoCode || storedDraft.appliedPromo.code} applied — You saved ${formatCurrency(Number(storedDraft?.appliedPromo?.discountAmount ?? 0) || 0)}`
          : resolvePromoValidationMessage(storedDraft?.appliedPromo) ||
            (storedDraft?.pendingPromoCode ? 'Promo will be applied after phone verification' : ''),
      );
      setPromoError(storedDraft?.appliedPromo?.valid ? '' : resolvePromoValidationMessage(storedDraft?.appliedPromo));
      return;
    }

    setCart([]);
    setSelectedPickupMode(PICKUP_MODES.ASAP);
    setScheduledPickupTime('');
    setPromoCodeInput('');
    setPendingPromoCode('');
    setAppliedPromo(null);
    setDiscountAmount(0);
    setFinalAmount(0);
    setPromoMessage('');
    setPromoError('');
    setShowManualPromoInput(false);
  }, [data?.restaurant?.id, routeKey, initialCustomerPhone]);

  useEffect(() => {
    setCustomerPhoneInput((prev) => prev || initialCustomerPhone || getVerifiedCustomerPhone() || '');
  }, [initialCustomerPhone]);

  useEffect(() => {
    if (showPhoneModal) {
      setSmsConsentAccepted(false);
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
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
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
  const finalTotal = useMemo(
    () => (appliedPromo?.valid ? finalAmount : subtotal),
    [appliedPromo?.valid, finalAmount, subtotal],
  );
  const restaurantIdForPromo = restaurant?.id || routeKey || '';
  const restaurantHistoryKey = restaurant?.id || routeKey;
  const pickupAvailability = useMemo(
    () => resolvePickupAvailability(data, restaurant),
    [data, restaurant],
  );
  const pickupSlotGroups = useMemo(
    () => buildPickupSlotGroups(pickupAvailability),
    [pickupAvailability],
  );
  const hasMenuItems = menu.length > 0;
  const customerOrdersList = useMemo(() => resolveCustomerOrdersList(customerOrdersData), [customerOrdersData]);
  const pickupDisplayTime = useMemo(
    () =>
      getPickupByLabel(
        selectedPickupMode,
        scheduledPickupTime,
        asapReadyTime,
        pickupAvailability?.timezone,
        pickupAvailability,
        pickupAvailability?.today?.windows || [],
      ),
    [selectedPickupMode, scheduledPickupTime, asapReadyTime, pickupAvailability],
  );
  const pickupReadyTime = useMemo(() => buildPickupTimestamp(asapReadyTime), [asapReadyTime]);

  useEffect(() => {
    if (!appliedPromo) {
      return;
    }

    const storedContext = appliedPromo.promoContext || {};
    const currentContext = {
      subtotal: Number(subtotal) || 0,
      restaurantId: String(restaurantIdForPromo || ''),
      customerPhone: String(normalizedCustomerPhone || ''),
    };
    const contextMatches =
      String(storedContext.restaurantId || '') === currentContext.restaurantId &&
      Number(storedContext.subtotal ?? storedContext.orderAmount ?? 0) === currentContext.subtotal &&
      String(storedContext.customerPhone || '') === currentContext.customerPhone;

    if (contextMatches) {
      return;
    }

    const nextPendingCode = normalizePromoCode(promoCodeInput || appliedPromo.promoCode || pendingPromoCode || '');
    setAppliedPromo(null);
    setDiscountAmount(0);
    setFinalAmount(subtotal);
    setPromoMessage('');
    setPromoError('');
    setPendingPromoCode(nextPendingCode);
  }, [appliedPromo, subtotal, restaurantIdForPromo, normalizedCustomerPhone, promoCodeInput, pendingPromoCode]);

  useEffect(() => {
    if (!pendingPromoCode || (appliedPromo?.valid && !appliedPromo?.optimistic) || !isCustomerPhoneValid) {
      return;
    }

    let active = true;

    async function validatePendingPromo() {
      setPromoSubmitting(true);
      setPromoError('');
      try {
        const response = await validatePromotion({
          promoCode: pendingPromoCode,
          customerPhone: normalizedCustomerPhone,
          orderAmount: subtotal,
          restaurantId: restaurantIdForPromo,
        });
        if (!active) {
          return;
        }
        const validation = normalizePromotionValidationResponse(response, subtotal, pendingPromoCode);
        if (validation.valid) {
          setAppliedPromo(validation);
          setPendingPromoCode('');
          setDiscountAmount(validation.discountAmount);
          setFinalAmount(validation.finalAmount);
          setPromoMessage(`${validation.promoCode} applied — You saved ${formatCurrency(validation.discountAmount)}`);
          setPromoError('');
          return;
        }

        setAppliedPromo(null);
        setPendingPromoCode('');
        setDiscountAmount(0);
        setFinalAmount(subtotal);
        setPromoMessage('');
        setPromoError(validation.message || 'Promo code is invalid or already used');
      } catch (error) {
        if (!active) {
          return;
        }
        setPromoError(String(error?.message || '').trim() || 'Unable to validate promo code right now.');
      } finally {
        if (active) {
          setPromoSubmitting(false);
        }
      }
    }

    validatePendingPromo();

    return () => {
      active = false;
    };
  }, [
    pendingPromoCode,
    appliedPromo?.valid,
    isCustomerPhoneValid,
    normalizedCustomerPhone,
    subtotal,
    restaurantIdForPromo,
  ]);

  const lastOrder = useMemo(() => {
    const sourceItems = normalizeOrderItems(data?.lastOrder);
    if (!sourceItems.length) {
      return getLastOrderFromHistory(
        customerOrdersList,
        restaurantHistoryKey,
        restaurant?.name || '',
      );
    }
    return {
      id: data?.lastOrder?.id || null,
      items: sourceItems,
      summary: sourceItems.map((item) => `${item.quantity}× ${item.name}`).join(', '),
    };
  }, [data?.lastOrder, customerOrdersList, restaurantHistoryKey, restaurant?.name]);

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
    if (pickupAvailability?.asapAllowed !== false || selectedPickupMode !== PICKUP_MODES.ASAP) {
      return;
    }

    setSelectedPickupMode(PICKUP_MODES.SCHEDULED);
    if (!scheduledPickupTime) {
      const firstAvailableSlot = pickupSlotGroups[0]?.slots?.[0]?.value || '';
      if (firstAvailableSlot) {
        setScheduledPickupTime(firstAvailableSlot);
      }
    }
  }, [pickupAvailability?.asapAllowed, pickupSlotGroups, scheduledPickupTime, selectedPickupMode]);

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
                sku: resolveMenuItemSku(item) || resolveMenuItemSku(menuItem),
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
          sku: resolveMenuItemSku(menuItem),
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
            sku: nextCart[index].sku || resolveMenuItemSku(orderItem),
          };
        } else {
          nextCart.push({ ...orderItem, id: orderItemId, sku: resolveMenuItemSku(orderItem) });
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
                sku: item.sku || resolveMenuItemSku(orderItem),
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
          sku: resolveMenuItemSku(orderItem),
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

  const openScheduleModal = () => {
    const initialSelection = getPickupScheduleDraftSelection(scheduledPickupTime, pickupSlotGroups);
    setScheduledPickupDraftDateKey(initialSelection.dateKey);
    setScheduledPickupDraftTime(initialSelection.slotValue);
    setShowScheduleModal(true);
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
  };

  const confirmScheduleSelection = () => {
    if (!scheduledPickupDraftTime) {
      return;
    }

    setSelectedPickupMode(PICKUP_MODES.SCHEDULED);
    setScheduledPickupTime(scheduledPickupDraftTime);
    setShowScheduleModal(false);
  };

  const pickupSummary = getPickupSummary(
    selectedPickupMode,
    scheduledPickupTime,
    asapReadyTime,
    pickupAvailability,
  );
  const missingScheduledTime = selectedPickupMode === PICKUP_MODES.SCHEDULED && !scheduledPickupTime;
  const closedAsapBlocked = selectedPickupMode === PICKUP_MODES.ASAP && pickupAvailability?.isOpenNow === false;
  const asapReadyLabel = getAsapReadyLabel(asapReadyTime, pickupAvailability);
  const menuErrorMessage =
    errorInfo?.offline
      ? 'You appear to be offline. Check your connection and try again.'
      : errorInfo?.kind === 'not_found'
      ? 'This restaurant menu is not available right now.'
      : 'We are having trouble loading this menu. Please try again.';

  const handleRetryMenu = () => {
    setRetryKey((current) => current + 1);
  };

  const applyOptimisticLaunchOffer = (promoCode) => {
    const optimisticDiscount = Math.min(2, subtotal);
    const optimisticFinalAmount = Math.max(subtotal - optimisticDiscount, 0);
    const optimisticPromo = {
      valid: true,
      promotionId: null,
      promoCode,
      reasonCode: null,
      discountAmount: optimisticDiscount,
      finalAmount: optimisticFinalAmount,
      message: '$2.00 discount applied',
      optimistic: true,
      promoContext: {
        subtotal,
        restaurantId: restaurantIdForPromo,
        customerPhone: normalizedCustomerPhone || '',
      },
    };
    setAppliedPromo(optimisticPromo);
    setPendingPromoCode(promoCode);
    setDiscountAmount(optimisticDiscount);
    setFinalAmount(optimisticFinalAmount);
    setPromoMessage(`${promoCode} applied — You saved ${formatCurrency(optimisticDiscount)}`);
    setPromoError('');
  };

  const applyPromoCode = async (nextPromoCode) => {
    const normalizedPromoCode = normalizePromoCode(nextPromoCode);
    setPromoError('');
    setPromoMessage('');

    if (!normalizedPromoCode) {
      setPromoError('Enter a promo code to apply.');
      return;
    }

    if (!isCustomerPhoneValid) {
      if (normalizedPromoCode === 'GO2PIK2') {
        applyOptimisticLaunchOffer(normalizedPromoCode);
        return;
      }

      setPendingPromoCode(normalizedPromoCode);
      setAppliedPromo(null);
      setDiscountAmount(0);
      setFinalAmount(subtotal);
      setPromoMessage('Promo will be applied after phone verification');
      return;
    }

    setPromoSubmitting(true);
    try {
      const response = await validatePromotion({
        promoCode: normalizedPromoCode,
        customerPhone: normalizedCustomerPhone,
        orderAmount: subtotal,
        restaurantId: restaurantIdForPromo,
      });
      const validation = normalizePromotionValidationResponse(response, subtotal, normalizedPromoCode);
      setAppliedPromo(validation);
      setPendingPromoCode('');
      setDiscountAmount(validation.valid ? validation.discountAmount : 0);
      setFinalAmount(validation.valid ? validation.finalAmount : subtotal);
      if (validation.valid) {
        setPromoMessage(`${validation.promoCode} applied — You saved ${formatCurrency(validation.discountAmount)}`);
        setPromoError('');
        return;
      }

      setPromoMessage(validation.message || '');
      setPromoError(validation.message || '');
    } catch (error) {
      setPendingPromoCode('');
      setPromoError(String(error?.message || '').trim() || 'Unable to validate promo code right now.');
    } finally {
      setPromoSubmitting(false);
    }
  };

  const handleLaunchOfferApply = () => {
    setPromoCodeInput('GO2PIK2');
    applyOptimisticLaunchOffer('GO2PIK2');
  };

  const handlePromoApply = async () => {
    void applyPromoCode(promoCodeInput);
  };

  const handleRemovePromo = () => {
    setPromoCodeInput('');
    setPendingPromoCode('');
    setAppliedPromo(null);
    setDiscountAmount(0);
    setFinalAmount(subtotal);
    setPromoMessage('');
    setPromoError('');
    setShowManualPromoInput(false);
  };

  const handlePlaceOrder = async () => {
    setOrderError('');
    if (!cart.length || !restaurant) {
      return;
    }
    if (closedAsapBlocked) {
      setOrderError('Restaurant is closed right now, please schedule the pickup during open hours');
      return;
    }
    if (cart.some((item) => !resolveMenuItemSku(item))) {
      setOrderError('One or more cart items are missing a menu sku. Please refresh the menu and try again.');
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
      customerPhone: getCustomerPhone(user) || getVerifiedCustomerPhone() || initialCustomerPhone,
      smsConsent: false,
      appliedPromo,
      promoCodeInput,
      pendingPromoCode,
      promoCode: appliedPromo?.valid ? appliedPromo.promoCode : '',
      restaurantRouteKey: restaurantId,
      restaurant,
      scheduledPickupTime,
      selectedPickupMode,
      subtotal,
      pickupSummary,
      pickupDisplayTime,
      pickupReadyTime,
      user,
    });
    storeCustomerOrderDraft(draft);
    setCustomerPhoneInput(getCustomerPhone(user) || getVerifiedCustomerPhone() || initialCustomerPhone);
    setSmsConsentAccepted(false);
    setShowPhoneModal(true);
  };

  const handleContinue = async () => {
    setOrderError('');
    const customerPhone = normalizedCustomerPhone;
    if (!customerPhoneInput.trim()) {
      setOrderError('Phone number is required');
      return;
    }
    if (!isCustomerPhoneValid) {
      setOrderError('Please enter a valid US phone number');
      return;
    }
    if (cart.some((item) => !resolveMenuItemSku(item))) {
      setOrderError('One or more cart items are missing a menu sku. Please refresh the menu and try again.');
      return;
    }
    const payload = buildCustomerOrderDraft({
      cart,
      cartItemById,
      customerName,
      customerPhone,
      smsConsent: Boolean(smsConsentAccepted),
      appliedPromo,
      promoCodeInput,
      pendingPromoCode,
      promoCode: appliedPromo?.valid ? appliedPromo.promoCode : '',
      restaurantRouteKey: restaurantId,
      restaurant,
      scheduledPickupTime,
      selectedPickupMode,
      subtotal,
      pickupSummary,
      pickupDisplayTime,
      pickupReadyTime,
      user,
    });

    storeCustomerOrderDraft(payload);
    if (smsConsentAccepted) {
      clearCustomerOrderVerification();
      setShowPhoneModal(false);
      setSmsConsentAccepted(false);
      navigate('/verification', {
        state: {
          orderDraft: payload,
          customerName: customerName || undefined,
          customerPhone,
          pendingVerification: true,
        },
      });
      return;
    }

    setContinuingOrder(true);
    try {
      const response = await submitOrder(payload);
      const responseOrder = response?.order || response?.data?.order || response;
      const confirmationOrderId = responseOrder?.id || response?.id;
      clearCustomerOrderVerification();
      clearCustomerOrderDraft();
      setShowPhoneModal(false);
      setSmsConsentAccepted(false);
      navigate(
        {
          pathname: '/order-confirmation',
          search: confirmationOrderId ? `?orderId=${encodeURIComponent(confirmationOrderId)}` : '',
        },
        {
          replace: true,
          state: {
            customerName: customerName || undefined,
            promoMeta: payload.appliedPromo || payload.promoValidation || undefined,
          },
        },
      );
    } catch (error) {
      setOrderError(String(error?.message || '').trim() || 'Unable to place your order right now.');
    } finally {
      setContinuingOrder(false);
    }
  };

  if (authLoading) {
    return (
      <main className="page-section">
        <AsyncState title="Loading your account" message="Please wait while we restore your session." loading />
      </main>
    );
  }

  if (!canBrowseMenu) {
    return (
      <Navigate
        to="/login"
        replace
        state={buildCustomerLoginState(getRestaurantMenuPath(routeKey), getCustomerHomePath())}
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
          onSecondaryAction={() => navigate(getCustomerHomePath())}
        />
      </main>
    );
  }

  return (
    <main className="page-section">
      <section className="menu-shell">
        <div className="card menu-panel">
          <button type="button" className="menu-back-link" onClick={() => navigate(getCustomerHomePath())}>
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
            onScheduleLaterClick={openScheduleModal}
            asapReadyTime={asapReadyTime}
            asapReadyLabel={asapReadyLabel}
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
              onSecondaryAction={() => navigate(getCustomerHomePath())}
            />
          )}
        </div>

        <CartSummary
          cart={cart}
          subtotal={subtotal}
          finalTotal={finalTotal}
        totalItems={totalItems}
        pickupSummary={pickupSummary}
        paymentMessage="No online payment required"
          disabled={!cart.length || missingScheduledTime || closedAsapBlocked}
          orderError={orderError}
          promoCodeInput={promoCodeInput}
          pendingPromoCode={pendingPromoCode}
          promoMessage={promoMessage}
          promoError={promoError}
          promoSubmitting={promoSubmitting}
          appliedPromo={appliedPromo}
          discountAmount={discountAmount}
          finalAmount={finalTotal}
          showManualPromoInput={showManualPromoInput}
          statusMessage={
            closedAsapBlocked
              ? 'Restaurant is closed right now, please schedule the pickup during open hours'
              : missingScheduledTime
                ? 'Choose a pickup time from the available hours.'
                : ''
          }
          onPromoCodeInputChange={(value) => {
            setPromoCodeInput(value);
            if (promoError) {
              setPromoError('');
            }
            const normalizedValue = normalizePromoCode(value);
            if (appliedPromo?.valid && normalizedValue !== appliedPromo.promoCode) {
              setAppliedPromo(null);
              setDiscountAmount(0);
              setFinalAmount(subtotal);
              setPromoMessage('');
              setPendingPromoCode('');
            }
            if (promoMessage && pendingPromoCode && normalizePromoCode(value) !== pendingPromoCode) {
              setPromoMessage('');
              setPendingPromoCode('');
            }
          }}
          onToggleManualPromoInput={() => setShowManualPromoInput((current) => !current)}
          onLaunchOfferApply={handleLaunchOfferApply}
          onApplyPromo={handlePromoApply}
          onRemovePromo={handleRemovePromo}
          onUpdateQuantity={updateQuantity}
          onPlaceOrder={handlePlaceOrder}
        />
      </section>

      {showPhoneModal ? (
        <PhoneModal
            customerPhone={customerPhoneInput}
            error={phoneValidationMessage || orderError}
            smsConsentAccepted={smsConsentAccepted}
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
            onSmsConsentChange={setSmsConsentAccepted}
            onContinue={handleContinue}
            continuingOrder={continuingOrder}
            phoneInputRef={phoneInputRef}
          />
      ) : null}

      {showScheduleModal ? (
        <SchedulePickupModal
          pickupAvailability={pickupAvailability}
          scheduledPickupGroups={pickupSlotGroups}
          selectedDateKey={scheduledPickupDraftDateKey}
          selectedTime={scheduledPickupDraftTime}
          onClose={closeScheduleModal}
          onConfirm={confirmScheduleSelection}
          onSelectDate={setScheduledPickupDraftDateKey}
          onSelectTime={setScheduledPickupDraftTime}
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
  smsConsent = false,
  appliedPromo,
  promoCodeInput,
  pendingPromoCode,
  promoCode,
  restaurantRouteKey,
  restaurant,
  scheduledPickupTime,
  selectedPickupMode,
  subtotal,
  pickupSummary,
  pickupDisplayTime,
  pickupReadyTime,
  user,
}) {
  const orderItems = cart.map((item) => ({
    ...item,
    sku: resolveMenuItemSku(item),
    quantity: item.quantity || 1,
    lineTotal: (item.price || 0) * (item.quantity || 1),
    specialInstructions: cartItemById[item.id]?.specialInstructions || item.specialInstructions || '',
  }));
  const pickupTime =
    selectedPickupMode === PICKUP_MODES.SCHEDULED
      ? buildPickupTimestamp(scheduledPickupTime)
      : undefined;

  return {
    restaurantId: restaurant.id,
    restaurantRouteKey: restaurantRouteKey || resolveRestaurantRouteKey(restaurant),
    restaurant,
    items: orderItems,
    subtotal,
    total: subtotal,
    appliedPromo: appliedPromo?.valid
      ? {
          ...appliedPromo,
          promoCode: appliedPromo.promoCode || appliedPromo.code || promoCode || '',
          reasonCode: appliedPromo.reasonCode ?? null,
          discountAmount: Number(appliedPromo.discountAmount ?? appliedPromo.discount_amount ?? 0) || 0,
          finalAmount: Number(appliedPromo.finalAmount ?? appliedPromo.final_amount ?? subtotal) || subtotal,
          promoContext: appliedPromo.promoContext || {
            subtotal,
            restaurantId: restaurant.id,
            customerPhone: customerPhone || '',
          },
        }
      : appliedPromo
        ? {
            ...appliedPromo,
            promoContext: appliedPromo.promoContext || {
              subtotal,
              restaurantId: restaurant.id,
              customerPhone: customerPhone || '',
            },
          }
        : null,
    promoValidation: appliedPromo
      ? {
          ...appliedPromo,
          promoContext: appliedPromo.promoContext || {
            subtotal,
            restaurantId: restaurant.id,
            customerPhone: customerPhone || '',
          },
        }
      : null,
    promoCodeInput: promoCodeInput || '',
    pendingPromoCode: pendingPromoCode || '',
    promoCode: promoCode || '',
    pickupRequest: {
      type: selectedPickupMode,
      scheduledTime: pickupTime,
      summary: pickupSummary,
      displayTime: selectedPickupMode === PICKUP_MODES.SCHEDULED ? pickupSummary : pickupDisplayTime || pickupSummary,
      readyTime: selectedPickupMode === PICKUP_MODES.ASAP ? pickupReadyTime || undefined : undefined,
    },
    customer: {
      name: customerName || getCustomerDisplayName(user) || '',
      phone: customerPhone,
      phoneNumber: customerPhone,
      email: user?.email || '',
      smsConsent: Boolean(smsConsent),
      pickupTime:
          selectedPickupMode === PICKUP_MODES.SCHEDULED
          ? pickupTime
          : pickupReadyTime || pickupTime,
      pickupDisplayTime: pickupDisplayTime || pickupSummary || '',
      notes: pickupSummary || '',
    },
    phoneNumber: customerPhone,
    smsConsent: Boolean(smsConsent),
    customerName: customerName || undefined,
  };
}

function normalizePromoCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizePromotionValidationResponse(response, orderAmount, promoCode) {
  const valid = Boolean(response?.valid);
  const promoCodeValue = normalizePromoCode(response?.promoCode || promoCode);
  const discountAmount = Number(response?.discountAmount);
  const finalAmount = Number(response?.finalAmount);
  const reasonCode = response?.reasonCode ?? null;
  const message = resolvePromoValidationMessage(response);

  return {
    valid,
    promotionId: response?.promotionId ?? null,
    promoCode: promoCodeValue,
    reasonCode,
    discountAmount: Number.isFinite(discountAmount) ? discountAmount : valid ? 0 : 0,
    finalAmount: Number.isFinite(finalAmount) ? finalAmount : Number(orderAmount) || 0,
    message,
    raw: response,
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

  const timezone = availability.timezone || defaultTimeZone();
  const groups = [];

  for (let offset = 0; offset < PICKUP_SLOT_LOOKAHEAD_DAYS; offset += 1) {
    const candidateDate = new Date();
    candidateDate.setDate(candidateDate.getDate() + offset);
    const dayParts = getDatePartsInTimeZone(candidateDate, timezone);
    const windows = getPickupWindowsForDate(availability, dayParts, offset);
    if (!windows.length) {
      continue;
    }

    const slots = windows.flatMap((window) => buildPickupSlotsForWindow(dayParts, window, timezone));
    if (!slots.length) {
      continue;
    }

    groups.push({
      key: `${dayParts.year}-${dayParts.month}-${dayParts.day}`,
      label: formatPickupDayLabel(candidateDate, timezone, offset),
      hoursLabel: formatPickupWindows(windows, timezone),
      slots,
    });
  }

  return groups;
}

function getPickupWindowsForDate(availability, dayParts, offset) {
  if (offset === 0) {
    return normalizePickupWindows(availability.today?.windows);
  }

  const weekday = dayParts.weekday || '';
  const weeklyEntry = resolveWeeklyScheduleEntry(availability.weeklySchedule, weekday);
  return normalizePickupWindows(weeklyEntry?.windows || weeklyEntry?.openHours || []);
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
  onScheduleLaterClick,
  asapReadyTime,
  asapReadyLabel,
}) {
  const isScheduled = selectedMode === PICKUP_MODES.SCHEDULED;
  const isOpenNow = Boolean(pickupAvailability?.isOpenNow);
  const asapAllowed = pickupAvailability?.asapAllowed !== false;
  const timezone = pickupAvailability?.timezone || '';
  const todayWindows = pickupAvailability?.today?.windows || [];
  const pickupStatusLabel = getPickupStatusLabel(pickupAvailability, todayWindows, timezone);
  const pickupByLabel = getPickupByLabel(
    selectedMode,
    scheduledPickupTime,
    asapReadyTime,
    timezone,
    pickupAvailability,
    todayWindows,
  );
  const showPickupReadyLine = !(pickupAvailability?.isOpenNow === false && pickupAvailability?.asapAllowed);

  return (
    <section className="pickup-card" aria-labelledby="pickup-card-title">
      <div className="card-heading">
        <p className="eyebrow">PICKUP TIME</p>
        <h3>Choose how you want to pick up your order</h3>
      </div>
      <div className="pickup-status-row">
        <span className={`pickup-status-dot${isOpenNow ? ' is-open' : ' is-closed'}`} aria-hidden="true" />
        <div className="pickup-status-copy">
          <p className="pickup-status-line">
            <strong>{isOpenNow ? 'Open' : 'Closed'}</strong>
            <span aria-hidden="true">•</span>
            <span>{isOpenNow ? `Closes at ${pickupStatusLabel}` : `Opens at ${pickupStatusLabel}`}</span>
          </p>
          <p className="pickup-status-message">
            {pickupAvailability?.statusMessage ||
              (isOpenNow
                ? 'The restaurant is open right now.'
                : 'Currently the restaurant is closed, but you can still place an order for later pickup.')}
          </p>
        </div>
      </div>
      <div className="pickup-summary-lines">
        {showPickupReadyLine ? <p className="pickup-ready-line">{asapReadyLabel}</p> : null}
        <p className="pickup-by-line">
          Pickup around <strong>{pickupByLabel}</strong>
        </p>
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
                  if (mode === PICKUP_MODES.ASAP) {
                    onModeChange(mode);
                  } else {
                    onScheduleLaterClick?.();
                  }
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
              <strong>Schedule your pickup</strong>
              <span className="muted">Pick a day and time from the available pickup window.</span>
            </div>
            <div className="pickup-selection-pill">
              <span className="pickup-selection-pill__label">Selected</span>
              <strong className="pickup-selection-pill__value">
                {scheduledPickupTime ? formatScheduledPickupSelection(scheduledPickupTime, timezone) : 'Choose a pickup time'}
              </strong>
              <button type="button" className="pickup-slot-toggle pickup-selection-pill__action" onClick={onScheduleLaterClick}>
                Change
              </button>
            </div>
            <button type="button" className="pickup-slot-toggle pickup-slot-toggle--primary" onClick={onScheduleLaterClick}>
              Open pickup scheduler
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getPickupScheduleDraftSelection(value, groups = []) {
  const normalizedValue = String(value || '').trim();
  for (const group of groups) {
    const slot = group.slots.find((entry) => entry.value === normalizedValue);
    if (slot) {
      return {
        dateKey: group.key,
        slotValue: slot.value,
      };
    }
  }

  const firstGroup = groups[0];
  return {
    dateKey: firstGroup?.key || '',
    slotValue: firstGroup?.slots?.[0]?.value || '',
  };
}

function findPickupScheduleGroup(groups = [], dateKey = '') {
  return groups.find((group) => group.key === dateKey) || null;
}

function SchedulePickupModal({
  pickupAvailability,
  scheduledPickupGroups,
  selectedDateKey,
  selectedTime,
  onClose,
  onConfirm,
  onSelectDate,
  onSelectTime,
}) {
  const timezone = pickupAvailability?.timezone || '';
  const activeGroup = findPickupScheduleGroup(scheduledPickupGroups, selectedDateKey) || scheduledPickupGroups[0] || null;
  const visibleGroups = scheduledPickupGroups.slice(0, 14);
  const visibleSlots = activeGroup?.slots || [];
  const selectedDateLabel = activeGroup?.label || visibleGroups[0]?.label || 'Select a date';
  const selectedTimeLabel =
    activeGroup?.slots?.find((slot) => slot.value === selectedTime)?.label || visibleSlots[0]?.label || 'Select a time';

  useEffect(() => {
    if (!scheduledPickupGroups.length) {
      return;
    }

    if (!findPickupScheduleGroup(scheduledPickupGroups, selectedDateKey)) {
      const firstGroup = scheduledPickupGroups[0];
      onSelectDate(firstGroup.key);
      onSelectTime(firstGroup.slots[0]?.value || '');
    }
  }, [onSelectDate, onSelectTime, scheduledPickupGroups, selectedDateKey]);

  useEffect(() => {
    if (!activeGroup) {
      return;
    }

    const stillValid = activeGroup.slots.some((slot) => slot.value === selectedTime);
    if (!stillValid) {
      onSelectTime(activeGroup.slots[0]?.value || '');
    }
  }, [activeGroup, onSelectTime, selectedTime]);

  if (!scheduledPickupGroups.length) {
    return (
      <div className="pickup-schedule-modal-backdrop" role="presentation" onClick={onClose}>
        <section className="pickup-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="pickup-schedule-modal-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="pickup-schedule-modal__close" onClick={onClose} aria-label="Close pickup scheduler">
            ×
          </button>
          <p className="pickup-schedule-modal__eyebrow">Pickup</p>
          <h2 id="pickup-schedule-modal-title">Schedule my order</h2>
          <p className="pickup-schedule-modal__subcopy">Select a pickup time up to 14 days in advance.</p>
          <p className="pickup-schedule-modal__empty">We do not have any pickup times available right now.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="pickup-schedule-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="pickup-schedule-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-schedule-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="pickup-schedule-modal__close" onClick={onClose} aria-label="Close pickup scheduler">
          ×
        </button>

        <header className="pickup-schedule-modal__header">
          <p className="pickup-schedule-modal__eyebrow">Pickup</p>
          <h2 id="pickup-schedule-modal-title">Schedule my order</h2>
          <p className="pickup-schedule-modal__subcopy">Select a pickup time up to 14 days in advance.</p>
        </header>

        <div className="pickup-schedule-modal__field-group">
          <div className="pickup-schedule-modal__field">
            <label className="pickup-schedule-modal__field-label" htmlFor="pickup-date-select">
              Date
            </label>
            <div className="pickup-schedule-modal__select-shell">
              <span className="pickup-schedule-modal__select-icon" aria-hidden="true">
                📅
              </span>
              <select
                id="pickup-date-select"
                className="pickup-schedule-modal__select"
                value={selectedDateKey || visibleGroups[0]?.key || ''}
                onChange={(event) => {
                  const nextDateKey = event.target.value;
                  const nextGroup = findPickupScheduleGroup(scheduledPickupGroups, nextDateKey) || scheduledPickupGroups[0] || null;
                  const nextTime = nextGroup?.slots?.[0]?.value || '';
                  onSelectDate(nextDateKey);
                  onSelectTime(nextTime);
                }}
              >
                {visibleGroups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label}
                  </option>
                ))}
              </select>
              <span className="pickup-schedule-modal__select-caret" aria-hidden="true">
                ›
              </span>
            </div>
          </div>

          <div className="pickup-schedule-modal__field">
            <label className="pickup-schedule-modal__field-label" htmlFor="pickup-time-select">
              Time
            </label>
            <div className="pickup-schedule-modal__select-shell">
              <span className="pickup-schedule-modal__select-icon" aria-hidden="true">
                ⏰
              </span>
              <select
                id="pickup-time-select"
                className="pickup-schedule-modal__select"
                value={selectedTime || visibleSlots[0]?.value || ''}
                onChange={(event) => onSelectTime(event.target.value)}
              >
                {visibleSlots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
              <span className="pickup-schedule-modal__select-caret" aria-hidden="true">
                ▾
              </span>
            </div>
          </div>
        </div>

        <footer className="pickup-schedule-modal__actions">
          <button
            type="button"
            className="primary-btn emphasis pickup-schedule-modal__confirm"
            onClick={onConfirm}
            disabled={!selectedTime || !selectedDateKey}
          >
            Pickup {selectedDateLabel} at {selectedTimeLabel}
          </button>
        </footer>
      </section>
    </div>
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

function resolveMenuItemSku(item = {}) {
  const directKeys = [
    item.sku,
    item.code,
    item.menuItemId,
    item.menu_item_id,
    item.menuItemID,
    item.menu_itemID,
  ];

  const directMatch = directKeys.find((value) => value !== undefined && value !== null && String(value).trim());
  if (directMatch === undefined || directMatch === null) {
    return '';
  }

  return directMatch;
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
  subtotal,
  finalTotal,
  totalItems,
  pickupSummary,
  paymentMessage,
  submitting,
  orderError,
  disabled,
  statusMessage,
  promoCodeInput,
  pendingPromoCode,
  promoMessage,
  promoError,
  promoSubmitting,
  appliedPromo,
  discountAmount,
  finalAmount,
  showManualPromoInput,
  onPromoCodeInputChange,
  onToggleManualPromoInput,
  onLaunchOfferApply,
  onApplyPromo,
  onRemovePromo,
  onUpdateQuantity,
  onPlaceOrder,
}) {
  const grandTotal = resolveMoneyDisplay(null, finalAmount ?? finalTotal ?? subtotal);
  const discountLine = Number(discountAmount) || 0;
  const isCartEmpty = cart.length === 0;
  const isPromoActive = Boolean(appliedPromo?.valid || pendingPromoCode);

  return (
    <aside className="card cart-panel cart-summary cart-wireframe">
      <div className="cart-header">
        <div>
          <p className="eyebrow">Pickup</p>
          <h3>{pickupSummary}</h3>
        </div>
        <div className="cart-total">
          <p className="eyebrow">Cart</p>
          <strong>{grandTotal}</strong>
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
          <div className="cart-promo">
            <div className="cart-promo__launch">
              <div className="cart-promo__launch-copy">
                <p className="eyebrow">Launch Offer 🎉</p>
                <strong>GO2PIK2 — Get $2 off your first pickup order</strong>
                {promoMessage ? <p className="cart-promo__message">{promoMessage}</p> : null}
                {promoError ? <p className="error-text cart-promo__error">{promoError}</p> : null}
              </div>
              <div className="cart-promo__launch-actions">
                {isPromoActive ? (
                  <button type="button" className="cart-promo__apply" onClick={onRemovePromo}>
                    Remove promo
                  </button>
                ) : (
                  <button type="button" className="cart-promo__apply" onClick={onLaunchOfferApply} disabled={promoSubmitting}>
                    {promoSubmitting ? 'Applying…' : 'Apply'}
                  </button>
                )}
              </div>
            </div>
            <button type="button" className="cart-promo__link" onClick={onToggleManualPromoInput}>
              Have another promo code?
            </button>
            {showManualPromoInput ? (
              <div className="cart-promo__manual">
                <div className="cart-promo__row">
                  <input
                    className="cart-promo__input"
                    type="text"
                    value={promoCodeInput}
                    onChange={(event) => onPromoCodeInputChange(event.target.value)}
                    placeholder="Enter code"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="cart-promo__apply"
                    onClick={onApplyPromo}
                    disabled={promoSubmitting || !promoCodeInput.trim()}
                  >
                    {promoSubmitting ? 'Applying…' : 'Apply'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="cart-preview-totals">
            {discountLine > 0 ? (
              <div className="cart-preview-totals-row">
                <span>Subtotal</span>
                <strong>{resolveMoneyDisplay(null, subtotal)}</strong>
              </div>
            ) : null}
            {discountLine > 0 ? (
              <div className="cart-preview-totals-row cart-preview-totals-row--discount">
                <span>Promo</span>
                <strong>-{resolveMoneyDisplay(null, discountLine)}</strong>
              </div>
            ) : null}
            <div className="cart-preview-totals-grand">
              <span>Estimated Total</span>
              <strong>{grandTotal}</strong>
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
      {!orderError && statusMessage ? <p className="muted cart-preview-status">{statusMessage}</p> : null}

      <button className="primary-btn cart-preview-cta" type="button" disabled={disabled || submitting} onClick={onPlaceOrder}>
        {submitting ? 'Placing order…' : 'Place Order'}
      </button>
    </aside>
  );
}

function PhoneModal({
  customerPhone,
  error,
  smsConsentAccepted,
  onClose,
  onCustomerPhoneChange,
  onSmsConsentChange,
  onContinue,
  continuingOrder,
  phoneInputRef,
}) {
  const host = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const privacyUrl = host ? `${host}/privacy` : '/privacy';
  const termsUrl = host ? `${host}/terms` : '/terms';

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
        <p className="phone-modal__eyebrow">Enter your phone number</p>
        <h2 id="phone-modal-title">For pickup identification at the restaurant.</h2>
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
        <label className="phone-modal__consent">
          <input
            type="checkbox"
            checked={smsConsentAccepted}
            onChange={(event) => onSmsConsentChange(event.target.checked)}
          />
          <span className="phone-modal__consent-copy" aria-label="SMS consent">
            <span className="phone-modal__consent-line">
              I agree to receive transactional SMS messages from Go2Pik, a service provided by Eha Technologies, for order updates including order confirmation, order status, and pickup alerts. Message frequency varies based on your activity. Message &amp; data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.
            </span>
            <span className="phone-modal__consent-links">
              <a className="phone-modal__consent-link" href={privacyUrl}>
                Privacy Policy
              </a>
              <a className="phone-modal__consent-link" href={termsUrl}>
                Terms &amp; Conditions
              </a>
            </span>
          </span>
        </label>
        {error ? <p className="error-text phone-modal__error">{error}</p> : null}
        <button
          type="button"
          className={`phone-modal__submit${continuingOrder ? ' is-disabled' : ''}`}
          onClick={onContinue}
          disabled={continuingOrder}
        >
          {continuingOrder ? 'Continuing…' : 'Continue'}
        </button>
        <p className="phone-modal__helper">
          <span aria-hidden="true">✓</span>
          <span>We never send messages without your permission.</span>
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
      ? formatScheduledPickupSelection(scheduledTime, pickupAvailability?.timezone)
      : 'Choose a pickup time';
  }
  return getAsapReadyLabel(asapReadyTime, pickupAvailability);
}

function getPickupStatusLabel(pickupAvailability, todayWindows = [], timezone) {
  const isOpenNow = Boolean(pickupAvailability?.isOpenNow);
  if (!Array.isArray(todayWindows) || todayWindows.length === 0) {
    return 'Soon';
  }

  const nextWindow = todayWindows[0];
  if (!nextWindow?.open || !nextWindow?.close) {
    return 'Soon';
  }

  const closeDate = buildTimeForFormatting(nextWindow.close, timezone);
  const openDate = buildTimeForFormatting(nextWindow.open, timezone);
  return isOpenNow
    ? formatPickupTimeLabel(closeDate, timezone)
    : formatPickupTimeLabel(openDate, timezone);
}

function getPickupByLabel(selectedMode, scheduledPickupTime, asapReadyTime, timezone, pickupAvailability, todayWindows = []) {
  if (selectedMode === PICKUP_MODES.SCHEDULED) {
    return scheduledPickupTime
      ? formatPickupClockLabel(scheduledPickupTime, timezone)
      : 'Choose a pickup time';
  }

  if (pickupAvailability?.asapAllowed === false) {
    return 'ASAP unavailable';
  }

  const firstWindow = Array.isArray(todayWindows) && todayWindows.length > 0 ? todayWindows[0] : null;
  if (pickupAvailability?.isOpenNow === false && firstWindow?.open) {
    return formatPickupTimeLabel(buildTimeForFormatting(firstWindow.open, timezone), timezone);
  }

  return formatPickupTimeLabel(buildTimeForFormatting(asapReadyTime || getTimeFromNow(PICKUP_WINDOW_MINUTES), timezone), timezone);
}

function formatPickupClockLabel(value, timezone) {
  if (!value) {
    return '';
  }

  if (String(value).includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString([], {
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
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || defaultTimeZone(),
  });
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
  if (pickupAvailability?.isOpenNow === false && pickupAvailability?.asapAllowed) {
    return 'Currently the restaurant is closed, but you can still place an order for later pickup.';
  }

  if (pickupAvailability?.asapAllowed === false) {
    return 'ASAP pickup is currently unavailable.';
  }

  return '⚡ ASAP (15–20 min)';
}

function getLastOrderFromHistory(orders = [], restaurantId, restaurantName = '') {
  if (!Array.isArray(orders) || !orders.length) {
    return null;
  }

  const ordersWithItems = [...orders]
    .map((order) => ({
      order,
      items: normalizeOrderItems(order),
    }))
    .filter((entry) => entry.items.length)
    .sort((a, b) => getOrderTimeValue(b.order) - getOrderTimeValue(a.order));

  if (!ordersWithItems.length) {
    return null;
  }

  const matchedOrder = restaurantId
    ? ordersWithItems.find((entry) => matchesRestaurantId(entry.order, restaurantId, restaurantName))
    : null;
  const selectedOrder = matchedOrder || ordersWithItems[0];
  const items = selectedOrder.items;

  return {
    id: selectedOrder.order.id || selectedOrder.order.orderNumber || null,
    items,
    summary: items.map((item) => `${item.quantity}× ${item.name}`).join(', '),
  };
}

function resolveCustomerOrdersList(customerOrdersData) {
  const directCandidates = [
    customerOrdersData?.orders,
    customerOrdersData?.orderHistory,
    customerOrdersData?.order_history,
    customerOrdersData?.history,
    customerOrdersData?.customer?.orders,
    customerOrdersData?.customer?.orderHistory,
    customerOrdersData?.customer?.order_history,
    customerOrdersData?.customer?.history,
    customerOrdersData?.data?.orders,
    customerOrdersData?.data?.orderHistory,
    customerOrdersData?.data?.order_history,
    customerOrdersData?.data?.history,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate;
    }
  }

  return [];
}

function matchesRestaurantId(order, restaurantId, restaurantName = '') {
  const orderRestaurantId =
    order?.restaurantId ||
    order?.restaurant?.id ||
    order?.restaurant_id ||
    order?.restaurant?.restaurantId ||
    order?.restaurant?.restaurant_id ||
    order?.restaurant?.slug ||
    order?.restaurant?.restaurantSlug ||
    '';

  if (String(orderRestaurantId).trim() === String(restaurantId).trim()) {
    return true;
  }

  const orderRestaurantName =
    order?.restaurant?.name ||
    order?.restaurantName ||
    order?.restaurant_name ||
    order?.restaurant?.displayName ||
    '';

  return Boolean(
    restaurantName &&
      String(orderRestaurantName).trim().toLowerCase() === String(restaurantName).trim().toLowerCase(),
  );
}

function normalizeOrderItems(order) {
  if (Array.isArray(order)) {
    return order
      .filter(Boolean)
      .map((item, index) => ({
        ...item,
        id: item?.id || item?.menuItemId || item?.menu_item_id || item?.sku || item?.name || `item-${index}`,
        sku: item?.sku ?? item?.code ?? item?.menuItemId ?? item?.menu_item_id ?? '',
        name: item?.name || item?.title || item?.label || 'Item',
        price: Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0),
        quantity: Number(item?.quantity || 1),
      }))
      .filter((item) => item.id && item.name);
  }

  const rawItems = resolveOrderItemsArray(order);

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map((item) => ({
      ...item,
      id: item?.id || item?.menuItemId || item?.menu_item_id || item?.sku || item?.name,
      sku: item?.sku ?? item?.code ?? item?.menuItemId ?? item?.menu_item_id ?? '',
      name: item?.name || item?.title || item?.label || 'Item',
      price: Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.lineTotal ?? item?.totalAmount ?? 0),
      quantity: Number(item?.quantity || 1),
    }))
    .filter((item) => item.id && item.name);
}

function resolveOrderItemsArray(order) {
  const directCandidates = [
    order?.items,
    order?.orderItems,
    order?.order_items,
    order?.lineItems,
    order?.line_items,
    order?.acceptedItems,
    order?.accepted_items,
    order?.visibleItems,
    order?.visible_items,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return findNestedOrderItemsArray(order);
}

function findNestedOrderItemsArray(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) {
    return null;
  }

  seen.add(value);

  const nestedKeys = [
    'order',
    'data',
    'result',
    'payload',
    'details',
    'lastOrder',
    'last_order',
    'orderData',
    'order_data',
  ];

  for (const key of nestedKeys) {
    const nested = value[key];
    if (!nested) {
      continue;
    }

    if (Array.isArray(nested)) {
      return nested;
    }

    const resolved = findNestedOrderItemsArray(nested, seen);
    if (resolved) {
      return resolved;
    }
  }

  for (const nested of Object.values(value)) {
    if (!nested || typeof nested !== 'object') {
      continue;
    }

    if (Array.isArray(nested)) {
      return nested;
    }

    const resolved = findNestedOrderItemsArray(nested, seen);
    if (resolved) {
      return resolved;
    }
  }

  return null;
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
