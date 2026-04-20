import { Link, Outlet, useLocation } from 'react-router-dom';
import CustomerProfileMenu from './CustomerProfileMenu.jsx';

export default function CustomerLayout() {
  const location = useLocation();
  const showHomeLink = location.pathname !== '/';

  return (
    <>
      <div className="customer-chrome">
        {showHomeLink ? (
          <Link className="customer-chrome__home" to="/" aria-label="Go to landing page">
            <span aria-hidden="true">⌂</span>
            <span>Home</span>
          </Link>
        ) : (
          <span />
        )}
        <CustomerProfileMenu />
      </div>
      <Outlet />
    </>
  );
}
