import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function LoginPage() {
  const { login, error, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(() => ({ email: location.state?.email || '', password: '' }));
  const [localError, setLocalError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);
    try {
      await login(form);
      const redirectTo = location.state?.from?.pathname || '/home';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleContinueAsGuest = () => {
    navigate('/home');
  };

  return (
    <main className="page-section">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <p>Use your foof-order-app credentials.</p>
        <label className="form-group">
          Email
          <input
            required
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
          />
        </label>
        <label className="form-group">
          Password
          <input
            required
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
          />
        </label>
        {(localError || error) && <p style={{ color: '#dc2626' }}>{localError || error}</p>}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="auth-secondary-actions">
          <button type="button" className="primary-btn ghost" onClick={handleContinueAsGuest}>
            Continue as guest
          </button>
          <div className="auth-links">
            <Link className="text-link" to="/password-update" state={{ email: form.email }}>
              Forgot password?
            </Link>
            <Link className="text-link" to="/signup" state={{ email: form.email }}>
              Create account
            </Link>
          </div>
        </div>
      </form>
    </main>
  );
}
