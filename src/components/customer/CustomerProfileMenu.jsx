import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getCustomerInitial } from '../../utils/customerIdentity.js';

export default function CustomerProfileMenu() {
  const location = useLocation();
  const { user, loading, isGuest } = useAuth();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  const profileSource = user || (isGuest ? { name: 'Guest' } : null);
  const customerInitial = getCustomerInitial(profileSource);

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
        aria-label="Open customer menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="customer-profile-trigger__avatar">{customerInitial}</span>
      </button>

      {open ? (
        <div className="customer-profile-menu customer-profile-menu--compact" role="menu" aria-label="Customer menu">
          {user && !isGuest ? (
            <Link className="customer-profile-menu__item" to="/orders" role="menuitem" onClick={() => setOpen(false)}>
              My Orders
            </Link>
          ) : (
            <Link
              className="customer-profile-menu__item"
              to="/login"
              role="menuitem"
              state={{ from: { pathname: location.pathname } }}
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
