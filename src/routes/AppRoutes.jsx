import { BrowserRouter, Route, Routes } from 'react-router-dom';
import LandingPage from '../pages/LandingPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import PasswordUpdatePage from '../pages/PasswordUpdatePage.jsx';
import SignupPage from '../pages/SignupPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import RestaurantMenuPage from '../pages/RestaurantMenuPage.jsx';
import CheckoutPage from '../pages/CheckoutPage.jsx';
import OrdersPage from '../pages/OrdersPage.jsx';
import OrderConfirmationPage from '../pages/OrderConfirmationPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/password-update" element={<PasswordUpdatePage />} />
        <Route path="/restaurants/:restaurantId/menu" element={<RestaurantMenuPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
