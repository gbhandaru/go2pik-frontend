import { Outlet } from 'react-router-dom';
import CustomerProfileMenu from './CustomerProfileMenu.jsx';

export default function CustomerLayout() {
  return (
    <>
      <div className="customer-chrome" aria-hidden="true">
        <CustomerProfileMenu />
      </div>
      <Outlet />
    </>
  );
}
