import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { fetchRestaurantMenu } from '../api/restaurantsApi.js';
import { useFetch } from '../hooks/useFetch.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getRestaurantAddressLines } from '../utils/formatRestaurantAddress.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { hasCustomerGuestAccess } from '../services/authStorage.js';
import { getCustomerPhone } from '../utils/customerIdentity.js';

const PICKUP_MODES = {
  ASAP: 'ASAP',
  SCHEDULED: 'SCHEDULED',
};
const PICKUP_WINDOW_MINUTES = 20;
const EARLIEST_PICKUP_MINUTES = 15;

export default function RestaurantMenuPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const customerName = useMemo(() => getCustomerDisplayName(user), [user]);
  const initialCustomerPhone = useMemo(() => getCustomerPhone(user), [user]);
  const [cart, setCart] = useState([]);
  const [selectedPickupMode, setSelectedPickupMode] = useState(PICKUP_MODES.ASAP);
  const [scheduledPickupTime, setScheduledPickupTime] = useState('');
  const [orderError, setOrderError] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState(initialCustomerPhone);
  const { data, loading, error } = useFetch(() => fetchRestaurantMenu(restaurantId), [restaurantId]);
  const asapReadyTime = useMemo(() => getTimeFromNow(PICKUP_WINDOW_MINUTES), []);
  const earliestAvailableTime = useMemo(() => getTimeFromNow(EARLIEST_PICKUP_MINUTES), []);
  const canBrowseMenu = Boolean(user) || hasCustomerGuestAccess();

  useEffect(() => {
    setCart([]);
    setSelectedPickupMode(PICKUP_MODES.ASAP);
    setScheduledPickupTime('');
  }, [restaurantId]);

  useEffect(() => {
    setCustomerPhoneInput((prev) => prev || initialCustomerPhone);
  }, [initialCustomerPhone]);

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

  const lastOrder = useMemo(() => {
    const sourceItems = data?.lastOrder?.items?.length
      ? data.lastOrder.items
      : menu.slice(0, 2).map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        }));
    if (!sourceItems.length) {
      return null;
    }
    return {
      id: data?.lastOrder?.id || 'mock-last-order',
      items: sourceItems,
      summary: sourceItems.map((item) => `${item.quantity}× ${item.name}`).join(', '),
    };
  }, [data?.lastOrder, menu]);

  const addToCart = (menuItem, options = {}) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.id === menuItem.id
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
          quantity: 1,
          specialInstructions: options.specialInstructions ?? '',
        },
      ];
    });
  };

  const updateQuantity = (itemId, nextQuantity) => {
    setCart((prev) => {
      if (nextQuantity <= 0) {
        return prev.filter((item) => item.id !== itemId);
      }
      return prev.map((item) => (item.id === itemId ? { ...item, quantity: nextQuantity } : item));
    });
  };

  const updateInstructions = (itemId, specialInstructions) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, specialInstructions } : item,
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
        const index = nextCart.findIndex((item) => item.id === orderItem.id);
        if (index > -1) {
          nextCart[index] = {
            ...nextCart[index],
            quantity: nextCart[index].quantity + orderItem.quantity,
          };
        } else {
          nextCart.push({ ...orderItem });
        }
      });
      return nextCart;
    });
  };

  const handlePickupModeChange = (mode) => {
    setSelectedPickupMode(mode);
    if (mode === PICKUP_MODES.ASAP) {
      setScheduledPickupTime('');
    }
  };

  const pickupSummary = getPickupSummary(selectedPickupMode, scheduledPickupTime, asapReadyTime);
  const missingScheduledTime = selectedPickupMode === PICKUP_MODES.SCHEDULED && !scheduledPickupTime;
  const asapReadyLabel = getAsapReadyLabel(asapReadyTime);
  const earliestAvailableLabel = getEarliestAvailableLabel(earliestAvailableTime);

  const handlePlaceOrder = async () => {
    setOrderError('');
    if (!cart.length || !restaurant) {
      return;
    }
    if (selectedPickupMode === PICKUP_MODES.SCHEDULED && !scheduledPickupTime) {
      return;
    }
    const customerPhone = customerPhoneInput.trim();
    if (!customerPhone) {
      setOrderError('Please enter a phone number before continuing to verification.');
      return;
    }
    const orderItems = cart.map(({ id, name, price, quantity }) => ({
      id,
      name,
      price,
      quantity,
      lineTotal: price * quantity,
      specialInstructions: cartItemById[id]?.specialInstructions || '',
    }));

    const payload = {
      restaurantId: restaurant.id,
      restaurant,
      items: orderItems,
      subtotal: total,
      total,
      pickupRequest: {
        type: selectedPickupMode,
        scheduledTime: scheduledPickupTime,
        summary: pickupSummary,
      },
      customer: {
        name: customerName || getCustomerDisplayName(user) || '',
        phone: customerPhone || '',
        email: user?.email || '',
        pickupTime: selectedPickupMode === PICKUP_MODES.SCHEDULED ? scheduledPickupTime || undefined : undefined,
        notes: pickupSummary || '',
      },
      customerName: customerName || undefined,
    };

    navigate('/checkout', {
      state: {
        orderDraft: payload,
        customerName: customerName || undefined,
        customerPhone: customerPhone || '',
      },
    });
  };

  if (loading) {
    return (
      <main className="page-section">
        <div className="page-empty-state">Loading menu...</div>
      </main>
    );
  }

  if (!canBrowseMenu) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: `/restaurants/${restaurantId}/menu` } }}
      />
    );
  }

  if (error || !data?.restaurant) {
    return (
      <main className="page-section">
        <div className="page-empty-state">Unable to load this restaurant right now.</div>
      </main>
    );
  }

  return (
    <main className="page-section">
      <section className="menu-shell">
        <div className="card menu-panel">
          <button type="button" className="menu-back-link" onClick={() => navigate('/home')}>
            <span aria-hidden="true">←</span>
            <span>Back to restaurants</span>
          </button>
          <div className="menu-header">
            <p className="eyebrow">Menu</p>
            <h2>{restaurant.name}</h2>
            <p className="muted">{restaurant.cuisine} • {restaurant.eta}</p>
            <p className="info-subtext">{renderRestaurantAddress(restaurant)}</p>
          </div>

          <PickupTimeCard
            selectedMode={selectedPickupMode}
            scheduledPickupTime={scheduledPickupTime}
            onModeChange={handlePickupModeChange}
            onTimeChange={setScheduledPickupTime}
            showTimeError={missingScheduledTime}
            asapReadyLabel={asapReadyLabel}
            earliestAvailableLabel={earliestAvailableLabel}
          />

          <ReorderCard
            items={lastOrder?.items}
            hasOrder={Boolean(lastOrder?.items?.length)}
            onReorder={reorderLastOrder}
          />

          <MenuList
            menu={menu}
            categories={categories}
            quantityById={quantityById}
            cartItemById={cartItemById}
            onAdd={addToCart}
            onUpdate={updateQuantity}
            onUpdateInstructions={updateInstructions}
          />
        </div>

        <CartSummary
          cart={cart}
          total={total}
          totalItems={totalItems}
          pickupSummary={pickupSummary}
          pickupMode={selectedPickupMode}
          scheduledPickupTime={scheduledPickupTime}
          paymentMessage="No online payment required"
          disabled={!cart.length || missingScheduledTime}
          orderError={orderError}
          customerPhone={customerPhoneInput}
          onCustomerPhoneChange={setCustomerPhoneInput}
          onUpdateQuantity={updateQuantity}
          onPlaceOrder={handlePlaceOrder}
        />
      </section>
    </main>
  );
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
  selectedMode,
  scheduledPickupTime,
  onModeChange,
  onTimeChange,
  showTimeError,
  asapReadyLabel,
  earliestAvailableLabel,
}) {
  const isScheduled = selectedMode === PICKUP_MODES.SCHEDULED;
  const scheduledTimeHelperId = 'scheduled-time-helper';
  const helperMessage = showTimeError
    ? 'Select a pickup time to continue'
    : earliestAvailableLabel || 'Earliest available: Soon';

  return (
    <section className="pickup-card" aria-labelledby="pickup-card-title">
      <div className="card-heading">
        <p className="eyebrow">Pickup time</p>
      </div>
      <div className="pickup-tabs" role="tablist" aria-label="Pickup options">
        {[PICKUP_MODES.ASAP, PICKUP_MODES.SCHEDULED].map((mode) => {
          const isActive = selectedMode === mode;
          const label = mode === PICKUP_MODES.ASAP ? 'ASAP' : 'Schedule for Later';
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`pickup-tab${isActive ? ' active' : ''}`}
              onClick={() => onModeChange(mode)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="pickup-details">
        {isScheduled ? (
          <div className="scheduled-picker">
            <label htmlFor="scheduled-time">Same-day pickup time</label>
            <input
              id="scheduled-time"
              type="time"
              value={scheduledPickupTime}
              onChange={(event) => onTimeChange(event.target.value)}
              min="07:00"
              max="22:00"
              step="900"
              required
              aria-invalid={showTimeError ? 'true' : 'false'}
              aria-describedby={scheduledTimeHelperId}
            />
            <p id={scheduledTimeHelperId} className={showTimeError ? 'error-text' : 'muted'}>
              {helperMessage}
            </p>
          </div>
        ) : (
          <div className="asap-preview" aria-live="polite">
            <p className="pickup-window">{asapReadyLabel}</p>
            {earliestAvailableLabel && <p className="muted pickup-helper">{earliestAvailableLabel}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

// Compact reorder card keeps the last order handy without overpowering the menu.
function ReorderCard({ items = [], hasOrder, onReorder }) {
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
                <span className="reorder-item-icon" aria-hidden="true">
                  {getItemBadgeLabel(item.name)}
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <span className="muted">
                    {item.quantity} × {formatCurrency(item.price)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">We will show your recent order here.</p>
        )}
      </div>
      <button type="button" className="reorder-card__button" onClick={onReorder} disabled={!hasOrder}>
        Reorder
      </button>
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
    return <p className="muted">Menu unavailable right now.</p>;
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
              {group.items.map((item, index) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  categoryLabel={group.category?.name || ''}
                  quantity={quantityById[item.id] || 0}
                  instructions={cartItemById[item.id]?.specialInstructions || ''}
                  isInstructionsExpanded={expandedItemId === item.id}
                  isBestseller={Boolean(item.isBestseller || item.is_bestseller || item.badge || (index === 0 && group.key === groupedMenu[0]?.key))}
                  onAdd={onAdd}
                  onUpdate={onUpdate}
                  onToggleInstructions={() => {
                    setExpandedItemId((current) => (current === item.id ? null : item.id));
                  }}
                  onUpdateInstructions={onUpdateInstructions}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MenuItemCard({
  item,
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
                onClick={() => onUpdate(item.id, quantity - 1)}
              >
                -
              </button>
              <span className="menu-stepper__count">{quantity}</span>
              <button
                type="button"
                className="menu-stepper__btn menu-stepper__btn--add"
                aria-label={`Increase ${item.name}`}
                onClick={() => onUpdate(item.id, quantity + 1)}
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
                onChange={(event) => onUpdateInstructions(item.id, event.target.value)}
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
  pickupMode,
  scheduledPickupTime,
  paymentMessage,
  submitting,
  orderError,
  customerPhone,
  onCustomerPhoneChange,
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

      <label className="cart-phone-field">
        Customer phone
        <input
          type="tel"
          value={customerPhone}
          onChange={(event) => onCustomerPhoneChange(event.target.value)}
          placeholder="+1 555 123 4567"
          autoComplete="tel"
        />
      </label>

      {orderError && <p className="error-text">{orderError}</p>}

      <button className="primary-btn cart-preview-cta" type="button" disabled={disabled || submitting} onClick={onPlaceOrder}>
        {submitting ? 'Placing order…' : 'Place order'}
      </button>
    </aside>
  );
}

function getPickupSummary(mode, scheduledTime, asapReadyTime) {
  if (mode === PICKUP_MODES.SCHEDULED) {
    return scheduledTime ? `Scheduled today at ${formatTime(scheduledTime)}` : 'Schedule pickup time';
  }
  return getAsapReadyLabel(asapReadyTime);
}

function formatTime(value) {
  if (!value) {
    return '';
  }
  const [hourString, minuteString] = value.split(':');
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

function getAsapReadyLabel(value) {
  return value ? `Pickup at ~${formatTime(value)} (15–20 min)` : 'Pickup in ~15–20 min';
}

function getEarliestAvailableLabel(value) {
  return value ? `Earliest available: ${formatTime(value)}` : '';
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
