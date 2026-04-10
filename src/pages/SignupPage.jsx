import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function SignupPage() {
  const { signup, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(() => ({
    fullName: '',
    email: location.state?.email || '',
    password: '',
    phone: '',
  }));
  const [localError, setLocalError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);
    try {
      const payload = {
        full_name: form.fullName,
        email: form.email,
        password: form.password,
        ...(form.phone ? { phone: form.phone } : {}),
      };
      await signup(payload);
      navigate('/home', { replace: true });
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login', { state: { email: form.email } });
  };

  return (
    <main className="page-section">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Create your Go2Pik account</h1>
        <p>Sign up with your email and build your pickup favorites faster.</p>
        <label className="form-group">
          Full name
          <input
            required
            type="text"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            placeholder="Jane Doe"
          />
        </label>
        <label className="form-group">
          Email address
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
            placeholder="Create a password"
          />
        </label>
        <label className="form-group">
          Phone (optional)
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="(555) 123-4567"
          />
        </label>
        {(localError || error) && <p style={{ color: '#dc2626' }}>{localError || error}</p>}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <div className="auth-links" style={{ width: '100%' }}>
          <button type="button" className="primary-btn ghost" onClick={handleBackToLogin}>
            Back to login
          </button>
          <Link className="text-link" to="/login" state={{ email: form.email }}>
            Already have an account?
          </Link>
        </div>
      </form>
    </main>
  );
}
