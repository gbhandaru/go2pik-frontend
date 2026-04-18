import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getStoredProfile } from '../../services/authStorage.js';
import { getCustomerDisplayName, getCustomerInitial } from '../../utils/customerIdentity.js';

export default function CustomerProfileMenu() {
  const { user, loading } = useAuth();

  const storedProfile = getStoredProfile();
  const profileSource = user || (loading ? storedProfile : null);
  const customerInitial = getCustomerInitial(profileSource);

  return (
    <Link className="customer-profile-trigger customer-profile-trigger--link" to="/orders" aria-label="My Orders">
      <span className="customer-profile-trigger__avatar">{customerInitial}</span>
    </Link>
  );
}
