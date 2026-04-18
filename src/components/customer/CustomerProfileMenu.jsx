import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  clearCustomerGuestAccess,
  getStoredProfile,
  setAuthNotice,
  setCustomerGuestAccess,
} from '../../services/authStorage.js';
import { getCustomerDisplayName, getCustomerInitial } from '../../utils/customerIdentity.js';

export default function CustomerProfileMenu() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const storedProfile = useMemo(() => getStoredProfile(), []);
  const profileSource = user || storedProfile || null;
  const customerName = useMemo(() => getCustomerDisplayName(profileSource), [profileSource]);
  const customerInitial = useMemo(() => getCustomerInitial(profileSource), [profileSource]);
  const hasCustomerSession = Boolean(isAuthenticated || profileSource);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    setAuthNotice('Your session has expired. Please sign in again.');
    clearCustomerGuestAccess();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="customer-profile" ref={menuRef}>
      <button
        type="button"
        className={`customer-profile-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={hasCustomerSession ? 'Open customer menu' : 'Customer menu'}
      >
        <span className="customer-profile-trigger__avatar">{customerInitial}</span>
        <span className="customer-profile-trigger__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="customer-profile-menu" role="menu" aria-label="Customer profile menu">
          {hasCustomerSession ? (
            <>
              <div className="customer-profile-menu__identity">
                <span className="customer-profile-menu__avatar">{customerInitial}</span>
                <div>
                  <strong>{customerName || 'Customer'}</strong>
                  <span>{profileSource?.phone || profileSource?.phone_number || profileSource?.email || ''}</span>
                </div>
              </div>
              <Link className="customer-profile-menu__item" to="/orders" onClick={() => setOpen(false)}>
                <span className="customer-profile-menu__icon" aria-hidden="true">
                  <OrdersIcon />
                </span>
                My Orders
              </Link>
              <button type="button" className="customer-profile-menu__item customer-profile-menu__item--logout" onClick={handleLogout}>
                <span className="customer-profile-menu__icon" aria-hidden="true">
                  <LogoutIcon />
                </span>
                Logout
              </button>
            </>
          ) : (
            <>
              <div className="customer-profile-menu__identity">
                <span className="customer-profile-menu__avatar">{customerInitial}</span>
                <div>
                  <strong>Guest</strong>
                  <span>Sign in or continue as guest</span>
                </div>
              </div>
              <Link className="customer-profile-menu__item" to="/login" onClick={() => setOpen(false)}>
                <span className="customer-profile-menu__icon" aria-hidden="true">
                  <UserIcon />
                </span>
                Sign in
              </Link>
              <button
                type="button"
                className="customer-profile-menu__item"
                onClick={() => {
                  setCustomerGuestAccess(true);
                  setOpen(false);
                  navigate('/home');
                }}
              >
                <span className="customer-profile-menu__icon" aria-hidden="true">
                  <GuestIcon />
                </span>
                Continue as guest
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
    </svg>
  );
}

function GuestIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-6 8v-1a6 6 0 0 1 12 0v1H6Z" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16v16H4z" fill="none" />
      <path d="M7 7h10M7 11h10M7 15h6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17v-2h4V9h-4V7l-5 5 5 5Zm9-13H12V2h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-7v-2h7V4Z" />
    </svg>
  );
}
