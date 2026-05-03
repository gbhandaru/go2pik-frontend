import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';
import { CateringRequestProvider } from './context/CateringRequestContext.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CateringRequestProvider>
          <AppRoutes />
        </CateringRequestProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
