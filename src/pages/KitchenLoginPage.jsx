import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { restaurantUserLogin } from '../api/authApi.js';
import { consumeKitchenAuthNotice, storeKitchenAuthTokens } from '../services/authStorage.js';

export default function KitchenLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionNotice, setSessionNotice] = useState(() => consumeKitchenAuthNotice());

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await restaurantUserLogin(form);
      storeKitchenAuthTokens({
        accessToken: response?.access_token,
        refreshToken: response?.refresh_token,
        profile: response?.user,
      });
      navigate('/kitchen/orders', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-section kitchen-page">
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 480, margin: '0 auto' }}>
        <p className="kitchen-header__eyebrow">Kitchen Access</p>
        <h1>Sign in to the kitchen</h1>
        <p className="kitchen-header__subtitle">For in-store teams managing pickup orders.</p>
        {sessionNotice ? <p className="auth-inline-notice">{sessionNotice}</p> : null}
        <label className="form-group">
          Email
          <input
            required
            type="email"
            name="email"
            placeholder="chef@restaurant.com"
            value={form.email}
            onChange={handleChange}
          />
        </label>
        <label className="form-group">
          Password
          <input
            required
            type="password"
            name="password"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
          />
        </label>
        {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
