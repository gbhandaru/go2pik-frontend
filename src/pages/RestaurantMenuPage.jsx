import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { submitOrder } from '../api/ordersApi.js';
import { fetchRestaurantMenu } from '../api/restaurantsApi.js';
import { useFetch } from '../hooks/useFetch.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const PICKUP_MODES = {
  ASAP: 'ASAP',
  SCHEDULED: 'SCHEDULED',
};

export default function RestaurantMenuPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [selectedPickupMode, setSelectedPickupMode] = useState(PICKUP_MODES.ASAP);
  const [scheduledPickupTime, setScheduledPickupTime] = useState('');
  const { data, loading, error } = useFetch(() => fetchRestaurantMenu(restaurantId), [restaurantId]);

  useEffect(() => {
    setCart([]);
    setOrderError(null);
    setSelectedPickupMode(PICKUP_MODES.ASAP);
    setScheduledPickupTime('');
  }, [restaurantId]);

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

  const menu = data?.menu || [];
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

  const addToCart = (menuItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { ...menuItem, quantity: 1 }];
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

  const pickupSummary = getPickupSummary(selectedPickupMode, scheduledPickupTime);

  const handlePlaceOrder = async () => {
    if (!cart.length || !restaurant) {
      return;
    }
    if (selectedPickupMode === PICKUP_MODES.SCHEDULED && !scheduledPickupTime) {
      return;
    }
    setSubmitting(true);
    setOrderError(null);
    try {
      const orderItems = cart.map(({ id, name, price, quantity }) => ({
        id,
        name,
        price,
        quantity,
        lineTotal: price * quantity,
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
      };

      const response = await submitOrder(payload);
      navigate('/order-confirmation', {
        state: {
          order: {
            ...payload,
            ...response,
            items: orderItems,
          },
        },
      });
    } catch (err) {
      setOrderError(err.message || 'Unable to place your order right now.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="page-section">
        <div className="page-empty-state">Loading menu...</div>
      </main>
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
          <button type="button" className="primary-btn ghost" onClick={() => navigate('/home')}>
            ← Back to restaurants
          </button>
          <div className="menu-header">
            <p className="eyebrow">Menu</p>
            <h2>{restaurant.name}</h2>
            <p className="muted">
              {restaurant.cuisine} • {restaurant.rating} ⭐ • {restaurant.eta}
            </p>
          </div>

          <PickupTimeCard
            selectedMode={selectedPickupMode}
            scheduledPickupTime={scheduledPickupTime}
            onModeChange={handlePickupModeChange}
            onTimeChange={setScheduledPickupTime}
          />

          <ReorderCard
            summary={lastOrder?.summary}
            hasOrder={Boolean(lastOrder?.items?.length)}
            onReorder={reorderLastOrder}
          />

          <MenuList
            menu={menu}
            quantityById={quantityById}
            onAdd={addToCart}
            onUpdate={updateQuantity}
          />
        </div>

        <CartSummary
          cart={cart}
          total={total}
          totalItems={totalItems}
          pickupSummary={pickupSummary}
          submitting={submitting}
          orderError={orderError}
          disabled={!cart.length || (selectedPickupMode === PICKUP_MODES.SCHEDULED && !scheduledPickupTime)}
          onPlaceOrder={handlePlaceOrder}
        />
      </section>
    </main>
  );
}

// Segmented pickup card keeps pickup choice visible for quick adjustments.
function PickupTimeCard({ selectedMode, scheduledPickupTime, onModeChange, onTimeChange }) {
  const isScheduled = selectedMode === PICKUP_MODES.SCHEDULED;

  return (
    <section className="pickup-card" aria-labelledby="pickup-card-title">
      <div className="card-heading">
        <p className="eyebrow">Pickup time</p>
        <h3 id="pickup-card-title">Choose how you'd like to pickup</h3>
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
            />
            <p className="muted">Select a time that works for you today.</p>
          </div>
        ) : (
          <p className="muted">Ready for pickup in 15–20 min</p>
        )}
      </div>
    </section>
  );
}

// Compact reorder card keeps the last order handy without overpowering the menu.
function ReorderCard({ summary, hasOrder, onReorder }) {
  return (
    <section className="reorder-card" aria-live="polite">
      <div>
        <p className="eyebrow">Reorder</p>
        <h3>Reorder your last order</h3>
        {hasOrder ? <p className="muted">{summary}</p> : <p className="muted">We will show your recent order here.</p>}
      </div>
      <button type="button" className="primary-btn secondary" onClick={onReorder} disabled={!hasOrder}>
        Reorder
      </button>
    </section>
  );
}

// Menu list stays lean so the cart retains secondary visual weight.
function MenuList({ menu, quantityById, onAdd, onUpdate }) {
  if (!menu.length) {
    return <p className="muted">Menu unavailable right now.</p>;
  }

  return (
    <div className="menu-items" aria-live="polite">
      {menu.map((item) => {
        const quantity = quantityById[item.id] || 0;
        return (
          <div className="menu-row" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              {item.description && <p className="muted">{item.description}</p>}
            </div>
            <div className="stepper">
              <span className="price">{formatCurrency(item.price)}</span>
              <div className="stepper-controls">
                <button
                  type="button"
                  aria-label={`Decrease ${item.name}`}
                  onClick={() => onUpdate(item.id, quantity - 1)}
                  disabled={quantity === 0}
                >
                  -
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase ${item.name}`}
                  onClick={() => (quantity > 0 ? onUpdate(item.id, quantity + 1) : onAdd(item))}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Cart summary mirrors pickup choice and keeps the place order action focused.
function CartSummary({ cart, total, totalItems, pickupSummary, submitting, orderError, disabled, onPlaceOrder }) {
  return (
    <aside className="card cart-panel cart-summary">
      <div className="cart-header">
        <div>
          <p className="eyebrow">Pickup</p>
          <h3>{pickupSummary}</h3>
        </div>
        <div className="cart-total">
          <p className="eyebrow">Cart</p>
          <strong>{formatCurrency(total)}</strong>
          <span className="muted">{totalItems || 0} items</span>
        </div>
      </div>

      {!cart.length && <p className="muted empty-cart">Add menu items to start an order.</p>}

      {cart.length > 0 && (
        <ul className="line-items cart-items">
          {cart.map((cartItem) => (
            <li key={cartItem.id}>
              <span>
                {cartItem.quantity} × {cartItem.name}
              </span>
              <strong>{formatCurrency(cartItem.price * cartItem.quantity)}</strong>
            </li>
          ))}
        </ul>
      )}

      {orderError && <p className="error-text">{orderError}</p>}

      <button className="primary-btn" type="button" disabled={disabled || submitting} onClick={onPlaceOrder}>
        {submitting ? 'Placing order…' : 'Place order'}
      </button>
    </aside>
  );
}

function getPickupSummary(mode, scheduledTime) {
  if (mode === PICKUP_MODES.SCHEDULED) {
    return scheduledTime ? `Scheduled today at ${formatTime(scheduledTime)}` : 'Schedule pickup time';
  }
  return 'ASAP • Ready in 15–20 min';
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
