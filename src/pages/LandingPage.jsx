import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import heroImage from '../assets/Go2Pik_Logo.png';
import { fetchRestaurants } from '../api/restaurantsApi.js';
import { useFetch } from '../hooks/useFetch.js';

const heroPerks = [
  { label: 'Pay at the restaurant', icon: '💳' },
  { label: 'Pickup when ready', icon: '📦' },
  { label: 'No hidden fees', icon: '✅' },
];

const howItWorks = [
  {
    id: 'step-1',
    title: 'Choose a Restaurant',
    subtitle: 'Browse nearby favorites and discover new spots.',
  },
  {
    id: 'step-2',
    title: 'Place Your Pickup Order',
    subtitle: 'Customize in seconds. Every detail saved to your cart.',
  },
  {
    id: 'step-3',
    title: 'Pick Up & Pay',
    subtitle: 'We update you when the kitchen starts and finishes.',
  },
];

const customerBenefits = [
  { title: 'Save Time', copy: 'Order before you leave home or work.' },
  { title: 'Pickup Only', copy: 'No delivery delays. No extra hassle.' },
  { title: 'Simple Pricing', copy: 'No hidden fees. What you see is what you pay.' },
  { title: 'Easy Reordering', copy: 'Get your favorites faster, every time.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { data: restaurants = [], loading } = useFetch(fetchRestaurants, []);
  const availableNow = useMemo(() => (restaurants || []).slice(0, 3), [restaurants]);

  function handleStartOrdering() {
    navigate('/home');
  }

  function handleBrowse() {
    navigate('/home');
  }

  return (
    <section className="landing hero-mode">
      <div className="landing-hero-shell">
        <header className="hero-nav">
          <div className="brand-mark">
            Go<span>2</span>Pik
          </div>
          <nav>
            <button type="button" onClick={handleBrowse}>
              Browse Restaurants
            </button>
            <button type="button" onClick={() => navigate('/orders')}>
              Track Orders
            </button>
          </nav>
          <div className="hero-nav-right">
            <a className="hero-contact" href="mailto:hello@go2pik.com">
              Contact
            </a>
            <button type="button" className="hero-nav-cta" onClick={handleStartOrdering}>
              Start Ordering
            </button>
          </div>
        </header>

        <div className="hero-body">
          <div className="hero-copy">
            <p className="hero-badge">Pickup-only food ordering</p>
            <h1>
              Order Ahead. <span>Skip the Wait.</span>
            </h1>
            <p className="hero-subtitle">
              Pickup-only ordering from your favorite restaurants. No delivery hassle. No hidden fees.
            </p>
            <div className="hero-cta-group">
              <button type="button" className="primary-btn hero-btn" onClick={handleStartOrdering}>
                Start Ordering
              </button>
              <button type="button" className="primary-btn hero-btn secondary" onClick={handleBrowse}>
                Browse Restaurants
              </button>
            </div>
            <div className="hero-social-proof">
              <div className="avatar-stack">
                <span />
                <span />
                <span />
              </div>
              <p>Loved by busy foodies in your area</p>
            </div>
            <div className="hero-links">
              <button type="button" onClick={handleStartOrdering}>
                Customer Login
              </button>
              <button type="button" onClick={handleStartOrdering}>
                Create Account
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <img src={heroImage} alt="Go2Pik experience" className="hero-preview" />
          </div>
        </div>

        <div className="hero-perks">
          {heroPerks.map((perk) => (
            <article key={perk.label}>
              <span>{perk.icon}</span>
              <p>{perk.label}</p>
            </article>
          ))}
        </div>

        <section id="how-it-works" className="hero-section">
          <p className="eyebrow">How it works</p>
          <h2>Three simple steps to your next great meal.</h2>
          <div className="steps-grid">
            {howItWorks.map((step, index) => (
              <article key={step.id}>
                <span className="step-index">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.subtitle}</p>
              </article>
            ))}
          </div>
        </section>

        {availableNow.length > 0 && (
          <section className="hero-section available-section">
            <p className="eyebrow">Available now</p>
            <div className="available-grid">
              {availableNow.map((rest) => (
                <article key={rest.id}>
                  <div className="available-logo">{rest.name?.charAt(0) || '•'}</div>
                  <h3>{rest.name}</h3>
                  <p className="muted">{rest.location || rest.cuisine}</p>
                </article>
              ))}
              {loading && (
                <article className="muted loading-message">Loading restaurants...</article>
              )}
            </div>
          </section>
        )}

        <section id="why-customers" className="hero-section">
          <p className="eyebrow">Why customers love Go2Pik</p>
          <div className="benefits-grid">
            {customerBenefits.map((benefit) => (
              <article key={benefit.title}>
                <h3>{benefit.title}</h3>
                <p>{benefit.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="hero-section hero-cta-panel">
          <div>
            <p className="eyebrow">Ready to skip the wait?</p>
            <h3>Get your food ready before you arrive.</h3>
          </div>
          <button type="button" className="primary-btn" onClick={handleStartOrdering}>
            Start Ordering
          </button>
        </section>

        <footer className="hero-footer">
          <p>© {new Date().getFullYear()} Go2Pik. All rights reserved.</p>
          <div>
            <button type="button">Privacy</button>
            <button type="button">Terms</button>
            <button type="button" onClick={() => (window.location.href = 'mailto:hello@go2pik.com')}>
              Contact
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
