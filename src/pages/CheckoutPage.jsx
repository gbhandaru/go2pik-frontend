import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AsyncState from '../components/shared/AsyncState.jsx';
import {
  clearCustomerOrderVerification,
  getCustomerOrderDraft,
  storeCustomerOrderDraft,
} from '../services/authStorage.js';
import { formatCurrency } from '../utils/formatCurrency.js';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orderDraft, setOrderDraft] = useState(() => location.state?.orderDraft || getCustomerOrderDraft());

  useEffect(() => {
    if (location.state?.orderDraft) {
      setOrderDraft(location.state.orderDraft);
      storeCustomerOrderDraft(location.state.orderDraft);
    }
  }, [location.state?.orderDraft]);

  const restaurant = orderDraft?.restaurant || null;
  const cart = Array.isArray(orderDraft?.items) ? orderDraft.items : [];
  const total = useMemo(
    () => normalizeAmount(orderDraft?.total ?? orderDraft?.subtotal ?? cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)),
    [cart, orderDraft?.subtotal, orderDraft?.total],
  );
  const customerName = orderDraft?.customerName || orderDraft?.customer?.name || '';
  const customerPhone = orderDraft?.customer?.phone || orderDraft?.customerPhone || '';
  const restaurantId = orderDraft?.restaurantId || restaurant?.id || null;

  const handleReloadDraft = () => {
    setOrderDraft(getCustomerOrderDraft());
  };

  const handleContinue = () => {
    if (!orderDraft) {
      return;
    }

    storeCustomerOrderDraft(orderDraft);
    clearCustomerOrderVerification();
    navigate('/verification', {
      state: {
        orderDraft,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      },
    });
  };

  const handleBack = () => {
    if (restaurantId) {
      navigate(`/restaurants/${restaurantId}/menu`);
      return;
    }
    navigate('/home');
  };

  if (!orderDraft) {
    return (
      <main className="page-section">
        <AsyncState
          title="Checkout unavailable"
          message="We could not restore your order draft. Retry to load the saved draft or return to restaurants."
          primaryActionLabel="Retry"
          onPrimaryAction={handleReloadDraft}
          secondaryActionLabel="Back to restaurants"
          onSecondaryAction={() => navigate('/home')}
        />
      </main>
    );
  }

  return (
    <main className="page-section">
      <header className="page-header">
        <p>Review your order</p>
        <h1>Checkout</h1>
        <p>{restaurant?.name || 'Selected restaurant'}</p>
      </header>

      <section className="card" aria-labelledby="checkout-summary-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Draft</p>
            <h2 id="checkout-summary-title">Order summary</h2>
          </div>
          <button type="button" className="menu-back-link" onClick={handleBack}>
            <span aria-hidden="true">←</span>
            <span>Back to menu</span>
          </button>
        </div>

        <p className="muted">{customerName ? `For ${customerName}` : 'Review the items before we send your verification code.'}</p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
          {cart.map((item) => (
            <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0' }}>
              <span>
                {item.quantity || 1} × {item.name}
              </span>
              <span>{formatCurrency((item.price || 0) * (item.quantity || 1))}</span>
            </li>
          ))}
        </ul>

        <hr />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>

        {customerPhone ? <p className="muted" style={{ marginTop: '0.75rem' }}>Verification will be sent to {formatPhone(customerPhone)}.</p> : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button className="primary-btn" type="button" onClick={handleContinue}>
            Continue to verification
          </button>
          <button className="primary-btn secondary" type="button" onClick={handleBack}>
            Back to menu
          </button>
        </div>
      </section>
    </main>
  );
}

function normalizeAmount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10) {
    return value;
  }

  const country = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '+1 ';
  const area = digits.slice(-10, -7);
  const prefix = digits.slice(-7, -4);
  const line = digits.slice(-4);
  return `${country}${area} ${prefix} ${line}`.replace(/\s+/g, ' ').trim();
}
