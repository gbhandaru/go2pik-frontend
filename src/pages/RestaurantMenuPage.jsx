import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { submitOrder } from '../api/ordersApi.js';
import { fetchRestaurantMenu } from '../api/restaurantsApi.js';
import { useFetch } from '../hooks/useFetch.js';
import { formatCurrency } from '../utils/formatCurrency.js';

export default function RestaurantMenuPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const { data, loading, error } = useFetch(() => fetchRestaurantMenu(restaurantId), [restaurantId]);

  useEffect(() => {
    setCart([]);
    setOrderError(null);
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

  const handlePlaceOrder = async () => {
    if (!cart.length || !data?.restaurant) {
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
        restaurantId: data.restaurant.id,
        restaurant: data.restaurant,
        items: orderItems,
        subtotal: total,
        total,
        pickupRequest: 'ASAP',
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

  const menu = data?.menu || [];

  return (
    <main className="page-section">
      <section className="menu-shell">
        <div className="card menu-panel">
          <button type="button" className="primary-btn ghost" onClick={() => navigate('/home')}>
            ← Back to restaurants
          </button>
          <div className="menu-header">
            <p className="eyebrow">Menu</p>
            <h2>{data.restaurant.name}</h2>
            <p className="muted">
              {data.restaurant.cuisine} • {data.restaurant.rating} ⭐ • {data.restaurant.eta}
            </p>
          </div>
          <div className="menu-items">
            {!menu.length && <p className="muted">Menu unavailable right now.</p>}
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
                        onClick={() => updateQuantity(item.id, quantity - 1)}
                        disabled={quantity === 0}
                      >
                        -
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        onClick={() => (quantity > 0 ? updateQuantity(item.id, quantity + 1) : addToCart(item))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="card cart-panel">
          <div className="cart-header">
            <div>
              <p className="eyebrow">Your cart</p>
              <h3>{totalItems || 0} items</h3>
            </div>
            <strong>{formatCurrency(total)}</strong>
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

          {orderError && <p style={{ color: '#dc2626' }}>{orderError}</p>}

          <button
            className="primary-btn"
            type="button"
            style={{ marginTop: 'auto', width: '100%' }}
            disabled={!cart.length || submitting}
            onClick={handlePlaceOrder}
          >
            {submitting ? 'Placing order…' : 'Place order'}
          </button>
        </aside>
      </section>
    </main>
  );
}
