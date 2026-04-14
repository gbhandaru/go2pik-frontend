import { Link } from 'react-router-dom';
import { fetchRestaurants } from '../api/restaurantsApi.js';
import { useFetch } from '../hooks/useFetch.js';

export default function HomePage() {
  const { data: restaurants, loading, error } = useFetch(fetchRestaurants, []);

  return (
    <main className="page-section">
      <header className="page-header">
        <p>Available near you</p>
        <h1>Pick a partner restaurant</h1>
        <p>These responses hydrate from the live API when available, otherwise mock data keeps the UI responsive.</p>
      </header>

      {loading && <div className="page-empty-state">Loading restaurants...</div>}
      {error && <div className="page-empty-state">{error}</div>}

      {!loading && !error && restaurants?.length > 0 && (
        <section className="card-grid">
          {restaurants.map((restaurant) => (
            <article className="card" key={restaurant.id}>
              {restaurant.heroImage && (
                <img
                  src={restaurant.heroImage}
                  alt={restaurant.name}
                  style={{ width: '100%', borderRadius: '8px', marginBottom: '1rem' }}
                />
              )}
              <h2>{restaurant.name}</h2>
              <p className="muted pickup-promise">Pickup in 15–20 mins</p>
              <p>
                {restaurant.cuisine} • {restaurant.rating || 'N/A'} ⭐ • {restaurant.eta}
              </p>
              <Link className="primary-btn" to={`/restaurants/${restaurant.id}/menu`}>
                View menu
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
