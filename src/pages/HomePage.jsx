import { Link } from 'react-router-dom';
import { fetchRestaurants } from '../api/restaurantsApi.js';
import { useFetch } from '../hooks/useFetch.js';

export default function HomePage() {
  const { data: restaurants, loading, error } = useFetch(fetchRestaurants, []);

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
            <Link className="restaurant-card-link" to={`/restaurants/${restaurant.id}/menu`} key={restaurant.id}>
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
                    <p className="restaurant-card__address">
                      {formatRestaurantAddress(restaurant)}
                    </p>
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

function formatRestaurantAddress(restaurant) {
  if (!restaurant) {
    return '';
  }

  const line1 =
    restaurant.address_line1 ||
    restaurant.addressLine1 ||
    restaurant.address1 ||
    restaurant.street ||
    '';
  const line2 = restaurant.address_line2 || restaurant.addressLine2 || '';
  const cityStateZip = [
    restaurant.city,
    restaurant.state,
    restaurant.postal_code || restaurant.postalCode || restaurant.zip,
  ]
    .filter(Boolean)
    .join(', ');
  const location = restaurant.location || '';

  return [line1, line2, cityStateZip, location].filter(Boolean).join(' • ');
}
