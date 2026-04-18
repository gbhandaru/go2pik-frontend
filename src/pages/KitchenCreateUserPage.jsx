import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchRestaurants } from '../api/restaurantsApi.js';
import { createRestaurantUser } from '../api/authApi.js';
import { useFetch } from '../hooks/useFetch.js';

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
  const [restaurantQuery, setRestaurantQuery] = useState('');
  const [restaurantReloadKey, setRestaurantReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { data: restaurantsData, loading: restaurantsLoading, error: restaurantsError } = useFetch(
    fetchRestaurants,
    [restaurantReloadKey],
  );

  const restaurants = useMemo(() => {
    if (Array.isArray(restaurantsData)) {
      return restaurantsData;
    }

    if (restaurantsData?.restaurants && Array.isArray(restaurantsData.restaurants)) {
      return restaurantsData.restaurants;
    }

    return [];
  }, [restaurantsData]);

  const filteredRestaurants = useMemo(() => {
    const normalizedQuery = restaurantQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return restaurants;
    }

    return restaurants.filter((restaurant) => {
      const haystack = [
        restaurant.id,
        restaurant.name,
        restaurant.cuisine,
        restaurant.location,
        restaurant.address_line1,
        restaurant.addressLine1,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [restaurants, restaurantQuery]);

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

  const handleRestaurantSelect = (event) => {
    setForm((prev) => ({ ...prev, restaurantId: event.target.value }));
  };

  const refreshRestaurants = useCallback(() => {
    setRestaurantReloadKey((current) => current + 1);
  }, []);

  return (
    <main className="page-section kitchen-page">
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 560, margin: '0 auto' }}>
        <p className="kitchen-header__eyebrow">Kitchen Access</p>
        <h1>Create a restaurant user</h1>
        <p className="kitchen-header__subtitle">Add a staff account for kitchen access.</p>

        <label className="form-group">
          Restaurant lookup
          <input
            type="search"
            placeholder="Search restaurant name or ID"
            value={restaurantQuery}
            onChange={(event) => setRestaurantQuery(event.target.value)}
          />
          <select
            required
            name="restaurantId"
            value={form.restaurantId}
            onChange={handleRestaurantSelect}
            disabled={restaurantsLoading}
          >
            <option value="">{restaurantsLoading ? 'Loading restaurants…' : 'Select a restaurant'}</option>
            {filteredRestaurants.map((restaurant) => (
              <option key={restaurant.id} value={String(restaurant.id)}>
                #{restaurant.id} - {restaurant.name}
              </option>
            ))}
          </select>
          <span className="muted">
            Choose the restaurant from the list. We use its numeric database ID behind the scenes.
          </span>
          {restaurantsError ? (
            <div className="auth-inline-notice">
              {restaurantsError} <button type="button" className="text-link" onClick={refreshRestaurants}>Retry</button>
            </div>
          ) : null}
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
