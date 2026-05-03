import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from '../pages/LandingPage.jsx';
import PrivacyPage from '../pages/PrivacyPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import PasswordUpdatePage from '../pages/PasswordUpdatePage.jsx';
import TermsPage from '../pages/TermsPage.jsx';
import SignupPage from '../pages/SignupPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import RestaurantMenuPage from '../pages/RestaurantMenuPage.jsx';
import OrdersPage from '../pages/OrdersPage.jsx';
import OrderConfirmationPage from '../pages/OrderConfirmationPage.jsx';
import OrderReviewPage from '../pages/OrderReviewPage.jsx';
import VerificationPage from '../pages/VerificationPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import KitchenLoginPage from '../pages/KitchenLoginPage.jsx';
import KitchenCreateUserPage from '../pages/KitchenCreateUserPage.jsx';
import KitchenOrdersPage from '../pages/KitchenOrdersPage.jsx';
import KitchenMenuPage from '../pages/KitchenMenuPage.jsx';
import KitchenReportsPage from '../pages/KitchenReportsPage.jsx';
import KitchenReadyPage from '../pages/KitchenReadyPage.jsx';
import KitchenCompletedPage from '../pages/KitchenCompletedPage.jsx';
import RestaurantMenuImport from '../pages/RestaurantMenuImport.jsx';
import CustomerLayout from '../components/customer/CustomerLayout.jsx';
import CateringIntroPage from '../pages/CateringIntroPage.jsx';
import CateringEventDetailsPage from '../pages/CateringEventDetailsPage.jsx';
import CateringItemsPage from '../pages/CateringItemsPage.jsx';
import CateringReviewItemsPage from '../pages/CateringReviewItemsPage.jsx';
import CateringFinalReviewPage from '../pages/CateringFinalReviewPage.jsx';
import CateringConfirmationPage from '../pages/CateringConfirmationPage.jsx';
import MyRequestsPage from '../pages/MyRequestsPage.jsx';
import RequestDetailsPage from '../pages/RequestDetailsPage.jsx';
import CateringPaymentPage from '../pages/CateringPaymentPage.jsx';
import RequestDishPage from '../pages/RequestDishPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/password-update" element={<PasswordUpdatePage />} />
        <Route path="/order/:orderNumber" element={<OrderReviewPage />} />
        <Route path="/catering" element={<CateringIntroPage />} />
        <Route path="/catering/event-details" element={<CateringEventDetailsPage />} />
        <Route path="/catering/items" element={<CateringItemsPage />} />
        <Route path="/catering/review-items" element={<CateringReviewItemsPage />} />
        <Route path="/catering/review" element={<CateringFinalReviewPage />} />
        <Route path="/catering/confirmation/:requestId" element={<CateringConfirmationPage />} />
        <Route path="/my-requests" element={<MyRequestsPage />} />
        <Route path="/my-requests/:requestId" element={<RequestDetailsPage />} />
        <Route path="/my-requests/:requestId/payment" element={<CateringPaymentPage />} />
        <Route path="/request-dish" element={<RequestDishPage />} />
        <Route element={<ProtectedRoute allowGuest />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/restaurants/:restaurantId/menu" element={<RestaurantMenuPage />} />
          <Route path="/verification" element={<VerificationPage />} />
          <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
        </Route>
        <Route element={<ProtectedRoute allowGuest={false} />}>
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
      </Route>
      <Route path="/restaurant/menu-import" element={<RestaurantMenuImport />} />
      <Route path="/kitchen/login" element={<KitchenLoginPage />} />
      <Route path="/kitchen/users/new" element={<KitchenCreateUserPage />} />
      <Route path="/kitchen" element={<Navigate to="/kitchen/orders" replace />} />
      <Route path="/kitchen/orders" element={<KitchenOrdersPage />} />
      <Route path="/kitchen/menu" element={<KitchenMenuPage />} />
      <Route path="/kitchen/reports" element={<KitchenReportsPage />} />
      <Route path="/kitchen/ready" element={<KitchenReadyPage />} />
      <Route path="/kitchen/completed" element={<KitchenCompletedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
