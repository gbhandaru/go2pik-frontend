import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { updateCustomerPassword } from '../api/authApi.js';
import { buildCustomerLoginState, getCustomerHomePath } from '../utils/customerFlow.js';

export default function PasswordUpdatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = location.state?.email || '';
  const [form, setForm] = useState({
    email: initialEmail,
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    newEmail: '',
  });
  const [status, setStatus] = useState({ loading: false, error: null, success: null });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: null, success: null });

    if (form.password !== form.confirmPassword) {
      setStatus({ loading: false, error: 'Passwords do not match.', success: null });
      return;
    }

    try {
      const payload = {
        email: form.email,
        password: form.password,
        ...(form.fullName ? { full_name: form.fullName } : {}),
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.newEmail ? { new_email: form.newEmail } : {}),
      };
      await updateCustomerPassword(payload);
      setStatus({ loading: false, error: null, success: 'Password updated. You can sign in now.' });
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'Unable to update password.', success: null });
    }
  };

  const handleBackToLogin = () => {
    navigate('/login', {
      state: {
        email: form.email,
        ...buildCustomerLoginState(getCustomerHomePath()),
      },
    });
  };

  return (
    <main className="page-section">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Update password</h1>
        <p>Enter the email associated with your Go2Pik profile and set a new password.</p>
        <p style={{ marginTop: '-0.5rem', color: '#475569' }}>
          You can optionally refresh your name, phone, or email while updating the password.
        </p>
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
          Full name (optional)
          <input
            type="text"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            placeholder="Jane Doe"
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
        <label className="form-group">
          New email (optional)
          <input
            type="email"
            name="newEmail"
            value={form.newEmail}
            onChange={handleChange}
            placeholder="new-you@example.com"
          />
        </label>
        <label className="form-group">
          New password
          <input
            required
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a new password"
          />
        </label>
        <label className="form-group">
          Confirm new password
          <input
            required
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter new password"
          />
        </label>
        {status.error && <p style={{ color: '#dc2626' }}>{status.error}</p>}
        {status.success && <p style={{ color: '#16a34a' }}>{status.success}</p>}
        <button className="primary-btn" type="submit" disabled={status.loading}>
          {status.loading ? 'Updating…' : 'Update password'}
        </button>
        <button type="button" className="primary-btn ghost" onClick={handleBackToLogin}>
          Back to login
        </button>
      </form>
    </main>
  );
}
