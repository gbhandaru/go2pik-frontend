import { Link, Outlet } from 'react-router-dom';
import CustomerProfileMenu from './CustomerProfileMenu.jsx';

export default function CustomerLayout() {
  return (
    <>
      <div className="customer-chrome">
        <Link className="customer-chrome__home" to="/home" aria-label="Go to home page">
          <span aria-hidden="true">⌂</span>
          <span>Home</span>
        </Link>
        <CustomerProfileMenu />
      </div>
      <Outlet />
    </>
  );
}
