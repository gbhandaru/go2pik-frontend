import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { submitOrder } from '../api/ordersApi.js';
import { formatCurrency } from '../utils/formatCurrency.js';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const cart = state?.cart || [];
  const restaurant = state?.restaurant;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitOrder({
        restaurantId: restaurant?.id,
        items: cart,
        total,
      });
      navigate('/orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart.length) {
    return (
      <main className="page-section">
        <div className="page-empty-state">
          <p>Your cart is empty</p>
          <button className="primary-btn" type="button" onClick={() => navigate('/')}>
            Browse restaurants
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-section">
      <header className="page-header">
        <p>Review and submit</p>
        <h1>Checkout</h1>
        <p>{restaurant?.name}</p>
      </header>

      <form className="card" onSubmit={handleSubmit}>
        <h2>Order summary</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {cart.map((item) => (
            <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <span>{item.name}</span>
              <span>{formatCurrency(item.price)}</span>
            </li>
          ))}
        </ul>
        <hr />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        <button className="primary-btn" type="submit" style={{ marginTop: '1.5rem' }} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Place order'}
        </button>
      </form>
    </main>
  );
}
