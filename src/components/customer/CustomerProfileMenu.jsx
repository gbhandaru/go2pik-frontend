import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { buildCustomerLoginState, getCustomerOrdersPath } from '../../utils/customerFlow.js';
import { getCustomerDisplayName, getCustomerInitial } from '../../utils/customerIdentity.js';

export default function CustomerProfileMenu() {
  const { user, loading, isGuest, isAuthenticated } = useAuth();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  const profileSource = user || (isGuest ? { name: 'Guest' } : null);
  const customerInitial = getCustomerInitial(profileSource);
  const customerName = getCustomerDisplayName(user);
  const triggerLabel = loading
    ? 'Loading account'
    : isAuthenticated
      ? `Hi, ${customerName || 'Customer'}`
      : isGuest
        ? 'Guest'
      : 'Sign in';

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <div className="customer-profile" ref={menuRef}>
      <button
        type="button"
        className="customer-profile-trigger customer-profile-trigger--button"
        aria-label={`${triggerLabel}. Open customer menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="customer-profile-trigger__avatar">{customerInitial}</span>
        <span className="customer-profile-trigger__label">{triggerLabel}</span>
      </button>

      {open ? (
        <div className="customer-profile-menu customer-profile-menu--compact" role="menu" aria-label="Customer menu">
          {isAuthenticated ? (
            <div className="customer-profile-menu__identity customer-profile-menu__identity--compact">
              <div className="customer-profile-menu__avatar" aria-hidden="true">
                {customerInitial}
              </div>
              <div>
                <strong>Hi, {customerName || 'Customer'}</strong>
                <span>Manage your orders and account</span>
              </div>
            </div>
          ) : isGuest ? (
            <div className="customer-profile-menu__identity customer-profile-menu__identity--compact">
              <div className="customer-profile-menu__avatar" aria-hidden="true">
                {customerInitial}
              </div>
              <div>
                <strong>Guest</strong>
                <span>Browse menus and place pickup orders</span>
              </div>
            </div>
          ) : (
            <div className="customer-profile-menu__identity customer-profile-menu__identity--compact">
              <div className="customer-profile-menu__avatar" aria-hidden="true">
                {customerInitial}
              </div>
              <div>
                <strong>Sign in</strong>
                <span>Access your orders and profile</span>
              </div>
            </div>
          )}

          {isAuthenticated ? (
            <>
              <Link className="customer-profile-menu__item" to={getCustomerOrdersPath()} role="menuitem" onClick={() => setOpen(false)}>
                My Orders
              </Link>
              <Link className="customer-profile-menu__item" to="/privacy" role="menuitem" onClick={() => setOpen(false)}>
                Privacy Policy
              </Link>
              <Link className="customer-profile-menu__item" to="/terms" role="menuitem" onClick={() => setOpen(false)}>
                Terms &amp; Conditions
              </Link>
            </>
          ) : (
            <>
              <Link
                className="customer-profile-menu__item"
                to="/login"
                role="menuitem"
                state={buildCustomerLoginState('/home')}
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
              <Link className="customer-profile-menu__item" to="/privacy" role="menuitem" onClick={() => setOpen(false)}>
                Privacy Policy
              </Link>
              <Link className="customer-profile-menu__item" to="/terms" role="menuitem" onClick={() => setOpen(false)}>
                Terms &amp; Conditions
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
