import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from '../pages/LandingPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import PasswordUpdatePage from '../pages/PasswordUpdatePage.jsx';
import SignupPage from '../pages/SignupPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import RestaurantMenuPage from '../pages/RestaurantMenuPage.jsx';
import OrdersPage from '../pages/OrdersPage.jsx';
import OrderConfirmationPage from '../pages/OrderConfirmationPage.jsx';
import VerificationPage from '../pages/VerificationPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import KitchenLoginPage from '../pages/KitchenLoginPage.jsx';
import KitchenCreateUserPage from '../pages/KitchenCreateUserPage.jsx';
import KitchenOrdersPage from '../pages/KitchenOrdersPage.jsx';
import KitchenMenuPage from '../pages/KitchenMenuPage.jsx';
import KitchenReadyPage from '../pages/KitchenReadyPage.jsx';
import KitchenCompletedPage from '../pages/KitchenCompletedPage.jsx';
import CustomerLayout from '../components/customer/CustomerLayout.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/password-update" element={<PasswordUpdatePage />} />
        <Route element={<ProtectedRoute allowGuest />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/restaurants/:restaurantId/menu" element={<RestaurantMenuPage />} />
          <Route path="/verification" element={<VerificationRedirect />} />
          <Route path="/checkout" element={<VerificationPage />} />
          <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
        </Route>
        <Route element={<ProtectedRoute allowGuest={false} />}>
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
      </Route>
      <Route path="/kitchen/login" element={<KitchenLoginPage />} />
      <Route path="/kitchen/users/new" element={<KitchenCreateUserPage />} />
      <Route path="/kitchen" element={<Navigate to="/kitchen/orders" replace />} />
      <Route path="/kitchen/orders" element={<KitchenOrdersPage />} />
      <Route path="/kitchen/menu" element={<KitchenMenuPage />} />
      <Route path="/kitchen/ready" element={<KitchenReadyPage />} />
      <Route path="/kitchen/completed" element={<KitchenCompletedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function VerificationRedirect() {
  const location = useLocation();
  return <Navigate to="/checkout" replace state={location.state} />;
}
