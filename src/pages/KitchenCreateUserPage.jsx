import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createRestaurantUser } from '../api/authApi.js';

const INITIAL_FORM = {
  restaurantId: '',
  full_name: '',
  email: '',
  password: '',
  phone: '',
};

export default function KitchenCreateUserPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await createRestaurantUser(form.restaurantId.trim(), {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        role: 'staff',
      });

      setSuccess('Restaurant user created. You can sign in with the new account now.');
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err.message || 'Unable to create restaurant user');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/kitchen/login', { replace: true });
  };

  return (
    <main className="page-section kitchen-page">
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 560, margin: '0 auto' }}>
        <p className="kitchen-header__eyebrow">Kitchen Access</p>
        <h1>Create a restaurant user</h1>
        <p className="kitchen-header__subtitle">Add a staff account for kitchen access.</p>

        <label className="form-group">
          Restaurant ID
          <input
            required
            type="text"
            name="restaurantId"
            placeholder="restaurant-123"
            value={form.restaurantId}
            onChange={handleChange}
          />
        </label>

        <label className="form-group">
          Full name
          <input
            required
            type="text"
            name="full_name"
            placeholder="Sushi Manager"
            value={form.full_name}
            onChange={handleChange}
          />
        </label>

        <label className="form-group">
          Email
          <input
            required
            type="email"
            name="email"
            placeholder="manager@sushi.com"
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

        <label className="form-group">
          Phone
          <input
            type="tel"
            name="phone"
            placeholder="555-123-4567"
            value={form.phone}
            onChange={handleChange}
          />
        </label>

        <p className="muted" style={{ margin: 0 }}>
          Role is set to <strong>staff</strong> for this invite flow.
        </p>

        {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
        {success && <p style={{ color: '#15803d', margin: 0 }}>{success}</p>}

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create user'}
        </button>

        <div className="auth-links login-links">
          <button type="button" className="guest-link" onClick={handleBackToLogin}>
            Back to kitchen login
          </button>
          <Link className="text-link" to="/kitchen/login">
            Sign in instead
          </Link>
        </div>
      </form>
    </main>
  );
}
