import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AsyncState from '../components/shared/AsyncState.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { fetchRestaurants } from '../api/restaurantsApi.js';
import { useFetch } from '../hooks/useFetch.js';
import { buildCustomerLoginState, getCustomerHomePath } from '../utils/customerFlow.js';
import { getRestaurantAddressLines } from '../utils/formatRestaurantAddress.js';
import { getRestaurantMenuPath } from '../utils/restaurantRoutes.js';

export default function HomePage() {
  const navigate = useNavigate();
  const { canAccessCustomerFlow } = useAuth();
  const [retryKey, setRetryKey] = useState(0);
  const { data: restaurants, loading, error, errorInfo } = useFetch(() => fetchRestaurants(), [retryKey]);
  const restaurantCount = restaurants?.length || 0;
  const showEmptyRestaurantSection = !loading && !error && restaurantCount < 4;
  const restaurantListError =
    errorInfo?.offline
      ? 'You appear to be offline. Check your connection and try again.'
      : 'We’re having trouble loading restaurants right now. Please try again.';

  const handleViewMenu = (restaurant, event) => {
    if (canAccessCustomerFlow) {
      return;
    }

    event.preventDefault();
    navigate('/login', {
      state: buildCustomerLoginState(getRestaurantMenuPath(restaurant), getCustomerHomePath()),
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

      {loading ? (
        <AsyncState title="Loading restaurants" message="Please wait while we load nearby spots." loading />
      ) : error ? (
        <AsyncState
          title="Restaurants unavailable"
          message={restaurantListError}
          primaryActionLabel="Retry"
          onPrimaryAction={() => setRetryKey((current) => current + 1)}
        />
      ) : null}

      {!loading && !error && showEmptyRestaurantSection && (
        <section className="card-grid">
          {restaurantCount > 0
            ? restaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  className="restaurant-card-link"
                  to={getRestaurantMenuPath(restaurant)}
                  onClick={(event) => handleViewMenu(restaurant, event)}
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
              ))
            : null}
          <article className="restaurant-empty-card" aria-label="More restaurants coming soon">
            <div className="restaurant-empty-card__text">
              <span className="restaurant-empty-card__line restaurant-empty-card__line--top">More</span>
              <span className="restaurant-empty-card__line restaurant-empty-card__line--bottom">Coming Soon</span>
            </div>
          </article>
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
