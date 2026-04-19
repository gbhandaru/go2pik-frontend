import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { fetchRestaurants } from '../api/restaurantsApi.js';
import { useFetch } from '../hooks/useFetch.js';
import { getRestaurantAddressLines } from '../utils/formatRestaurantAddress.js';

export default function HomePage() {
  const navigate = useNavigate();
  const { canAccessCustomerFlow } = useAuth();
  const { data: restaurants, loading, error } = useFetch(fetchRestaurants, []);
  const canBrowseMenu = canAccessCustomerFlow;

  const handleViewMenu = (restaurantId, event) => {
    if (canBrowseMenu) {
      return;
    }

    event.preventDefault();
    navigate('/login', {
      state: {
        from: { pathname: `/restaurants/${restaurantId}/menu` },
      },
    });
  };

  return (
    <main className="page-section">
      <header className="home-hero">
        <p className="home-hero__eyebrow">Available near you</p>
        <h1>
          Order ahead from nearby{' '}
          <span>restaurants</span>
        </h1>
        <p className="home-hero__subhead">Pickup only. No hidden fees.</p>
      </header>

      {loading && <div className="page-empty-state">Loading restaurants...</div>}
      {error && <div className="page-empty-state">{error}</div>}

      {!loading && !error && restaurants?.length > 0 && (
        <section className="card-grid">
          {restaurants.map((restaurant) => (
            <Link
              key={restaurant.id}
              className="restaurant-card-link"
              to={`/restaurants/${restaurant.id}/menu`}
              onClick={(event) => handleViewMenu(restaurant.id, event)}
            >
              <article className="card restaurant-card">
                {restaurant.heroImage && (
                  <div className="restaurant-card__image-wrap">
                    <img src={restaurant.heroImage} alt={restaurant.name} className="restaurant-card__image" />
                  </div>
                )}
                <div className="restaurant-card__body">
                  <div className="restaurant-card__heading">
                    <p className="restaurant-card__tag">Restaurant</p>
                    <h2>{restaurant.name}</h2>
                  </div>
                  <div className="restaurant-card__meta">
                    <p className="restaurant-card__pickup">{restaurant.eta || 'Pickup in 15–20 mins'}</p>
                    <p className="restaurant-card__address">{renderRestaurantAddress(restaurant)}</p>
                  </div>
                  <p className="restaurant-card__details">{restaurant.cuisine}</p>
                  <span className="primary-btn restaurant-card__cta">View Menu</span>
                </div>
              </article>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

function renderRestaurantAddress(restaurant) {
  const { line1, secondary } = getRestaurantAddressLines(restaurant);
  return (
    <>
      {line1}
      {secondary ? (
        <>
          <br />
          <span className="restaurant-card__address-secondary">{secondary}</span>
        </>
      ) : null}
    </>
  );
}
