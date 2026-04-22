import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { restaurantUserLogout } from '../api/authApi.js';
import { fetchKitchenOrdersReport } from '../api/ordersApi.js';
import KitchenTabs from '../components/kitchen/KitchenTabs.jsx';
import { KITCHEN_MAIN_TABS } from '../components/kitchen/kitchenMainTabs.js';
import { normalizeAppError } from '../utils/appError.js';
import { clearKitchenAuthTokens, getKitchenRefreshToken, getKitchenRestaurantId } from '../services/authStorage.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const RANGE_TABS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

const CUSTOM_MODES = [
  { value: 'date', label: 'Single Day' },
  { value: 'range', label: 'Date Range' },
];

const STATUS_ORDER = ['new', 'accepted', 'preparing', 'ready_for_pickup', 'completed', 'rejected', 'cancelled'];
const TODAY_INITIAL = getTodayInputValue();

export default function KitchenReportsPage() {
  const navigate = useNavigate();
  const restaurantId = getKitchenRestaurantId() || '';
  const [rangeMode, setRangeMode] = useState('today');
  const [customMode, setCustomMode] = useState('date');
  const [singleDate, setSingleDate] = useState(TODAY_INITIAL);
  const [rangeFrom, setRangeFrom] = useState(TODAY_INITIAL);
  const [rangeTo, setRangeTo] = useState(TODAY_INITIAL);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const queryParams = useMemo(
    () => buildReportQuery(rangeMode, customMode, singleDate, rangeFrom, rangeTo),
    [rangeMode, customMode, singleDate, rangeFrom, rangeTo],
  );

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setError('Restaurant context is not available yet.');
      setReport(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    async function loadReport() {
      try {
        const response = await fetchKitchenOrdersReport(restaurantId, queryParams);
        if (!active) {
          return;
        }

        const nextReport = response?.report || null;
        if (!nextReport) {
          throw new Error('No report data was returned by the server.');
        }
        setReport(nextReport);
        setLastUpdated(new Date());
      } catch (err) {
        if (!active) {
          return;
        }
        const normalized = normalizeAppError(err);
        setError(normalized.message || 'Unable to load the sales report.');
        setReport(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      active = false;
    };
  }, [restaurantId, queryParams, refreshNonce]);

  const handleMainTabChange = (tab) => {
    if (tab === 'orders') {
      navigate('/kitchen/orders');
      return;
    }

    if (tab === 'menu') {
      navigate('/kitchen/menu');
    }
  };

  const handleLogout = async () => {
    const refreshToken = getKitchenRefreshToken();
    try {
      if (refreshToken) {
        await restaurantUserLogout(refreshToken);
      }
    } catch (err) {
      console.warn('Failed to notify server about kitchen logout', err);
    } finally {
      clearKitchenAuthTokens();
      navigate('/kitchen/login', { replace: true });
    }
  };

  const handleRefresh = () => {
    setRefreshNonce((current) => current + 1);
  };

  const handleRangeModeChange = (nextMode) => {
    setRangeMode(nextMode);
    if (nextMode === 'custom') {
      setCustomMode((current) => current || 'date');
    }
  };

  const reportContext = getReportContextLabel(report, rangeMode, customMode, singleDate, rangeFrom, rangeTo);
  const timezoneAbbrev = formatTimezoneAbbrev(report?.timezone);
  const timezoneLabel = report?.timezone ? `Timezone: ${timezoneAbbrev}` : 'Using the restaurant timezone returned by the backend.';
  const reportHeading = `Sales Report - ${reportContext}`;
  const totals = report?.totals || {};
  const statusCounts = report?.statusCounts || {};
  const items = Array.isArray(report?.items) ? report.items : [];
  const graphSeries = Array.isArray(report?.graphSeries) ? report.graphSeries : [];
  const commissionRateLabel = formatCommissionRateLabel(report?.commissionRate);
  const pendingOrders = normalizeNumber(report?.pendingOrders);
  const summaryLabel = rangeMode === 'today' ? 'Today Sales' : 'Gross Sales';
  const avgOrderValue = hasMeaningfulValue(report?.avgOrderDisplay, report?.avgOrder)
    ? formatMoneyDisplay(report?.avgOrderDisplay, report?.avgOrder)
    : fallbackAverageOrder(totals.amount, totals.orders);
  const grossSalesLabel = formatMoneyDisplay(totals.amountDisplay, totals.amount);
  const topItemsLabel = rangeMode === 'today' ? 'Top Items Today' : 'Top Items';
  const hasGraphSeries = graphSeries.length > 0;
  const graphMetaLabel = hasGraphSeries ? `${graphSeries.length} point${graphSeries.length === 1 ? '' : 's'}` : 'No trend data';
  const graphEmptyMessage = hasGraphSeries
    ? 'No Sales yet for this period.'
    : 'No Sales yet for this period. Try Week or Month to view a trend.';

  return (
    <main className="page-section kitchen-page kitchen-dashboard kitchen-reports-page">
      <header className="card kitchen-dashboard__topbar">
        <div className="kitchen-dashboard__brand">
          <p className="kitchen-dashboard__eyebrow">GO2PIK KITCHEN</p>
          <h1>Sales Report</h1>
        </div>
        <div className="kitchen-dashboard__updated">
          <span>{lastUpdated ? `Last updated: ${formatTimestamp(lastUpdated)}` : 'Last updated: —'}</span>
        </div>
        <div className="kitchen-dashboard__actions">
          <Link className="kitchen-icon-btn kitchen-icon-btn--link" to="/kitchen/users/new" aria-label="Create restaurant user">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 7v-1a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v1h-2v-1a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3v1Zm11-10V8h-2V5h-2v3h-2v2h2v3h2v-3Z" />
            </svg>
          </Link>
          <button type="button" className="kitchen-icon-btn" onClick={handleRefresh} aria-label="Refresh report">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.6V4h2v8h-8V10l2.7 2.7A6 6 0 1 0 18 17h2a8 8 0 1 1-16-5Z" />
            </svg>
          </button>
          <button type="button" className="kitchen-icon-btn" onClick={handleLogout} aria-label="Logout">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17v-2h4V9h-4V7l-5 5 5 5Zm9-13H12V2h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-7v-2h7V4Z" />
            </svg>
          </button>
        </div>
      </header>

      <section className="card kitchen-toolbar kitchen-main-tabs">
        <KitchenTabs tabs={KITCHEN_MAIN_TABS} activeTab="reports" onTabChange={handleMainTabChange} />
      </section>

      <section className="kitchen-report-hero">
        <div>
          <p className="eyebrow">Revenue snapshot</p>
          <h2>{reportHeading}</h2>
          <p className="muted">{timezoneLabel}</p>
        </div>
      </section>

      <section className="card kitchen-report-filters">
        <div className="kitchen-report-filters__top">
          <div className="kitchen-report-filter-tabs" role="tablist" aria-label="Report range">
            {RANGE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`kitchen-report-filter-tab${rangeMode === tab.value ? ' active' : ''}`}
                onClick={() => handleRangeModeChange(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`kitchen-report-today-btn${rangeMode === 'today' ? ' active' : ''}`}
            onClick={() => handleRangeModeChange('today')}
          >
            Today
          </button>
        </div>

        {rangeMode === 'custom' ? (
          <>
            <div className="kitchen-report-filter-tabs" role="tablist" aria-label="Custom range mode">
              {CUSTOM_MODES.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`kitchen-report-filter-tab${customMode === tab.value ? ' active' : ''}`}
                  onClick={() => setCustomMode(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="kitchen-report-date-controls">
              {customMode === 'date' ? (
                <label className="kitchen-report-date-field">
                  <span>Report date</span>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(event) => setSingleDate(event.target.value || TODAY_INITIAL)}
                  />
                </label>
              ) : null}

              {customMode === 'range' ? (
                <>
                  <label className="kitchen-report-date-field">
                    <span>From</span>
                    <input
                      type="date"
                      value={rangeFrom}
                      onChange={(event) => setRangeFrom(event.target.value || TODAY_INITIAL)}
                    />
                  </label>
                  <label className="kitchen-report-date-field">
                    <span>To</span>
                    <input
                      type="date"
                      value={rangeTo}
                      onChange={(event) => setRangeTo(event.target.value || TODAY_INITIAL)}
                    />
                  </label>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        <p className="kitchen-report-filters__summary muted">Selected period: {reportContext}</p>
      </section>

      {loading ? <ReportLoadingState /> : null}

      {!loading && error ? (
        <section className="card kitchen-report-error">
          <div>
            <p className="eyebrow">Unable to load report</p>
            <h3>Try again in a moment</h3>
            <p className="muted">{error}</p>
          </div>
          <button type="button" className="primary-btn secondary" onClick={handleRefresh}>
            Retry
          </button>
        </section>
      ) : null}

      {!loading && !error && report ? (
        <>
          <section className="kitchen-report-metrics">
            <article className="card kitchen-report-metric">
              <p>{summaryLabel}</p>
              <strong>{grossSalesLabel}</strong>
            </article>
            <article className="card kitchen-report-metric">
              <p>Orders</p>
              <strong>{normalizeNumber(totals.orders)}</strong>
            </article>
            <article className="card kitchen-report-metric">
              <p>Avg Order</p>
              <strong>{avgOrderValue}</strong>
            </article>
            <article className="card kitchen-report-metric">
              <p>Pending</p>
              <strong>{pendingOrders}</strong>
            </article>
          </section>

          <section className="card kitchen-report-chart">
            <div className="kitchen-report-card-header">
              <div>
                <p className="eyebrow">Sales Graph</p>
                <h3>Sales trend</h3>
              </div>
              <span className="muted">{graphMetaLabel}</span>
            </div>

            {hasGraphSeries ? (
              <div className="kitchen-report-series">
                {graphSeries.map((point, index) => (
                  <article key={getGraphPointKey(point, index)} className="kitchen-report-series__point">
                    <div className="kitchen-report-series__header">
                      <strong>{formatGraphDate(point.date)}</strong>
                      <span>{formatMoneyDisplay(point.amountDisplay, point.amount)}</span>
                    </div>
                    <div className="kitchen-report-series__bar-track" aria-hidden="true">
                      <span
                        className="kitchen-report-series__bar-fill"
                        style={{ height: `${getGraphBarHeight(point.amount, graphSeries)}%` }}
                      />
                    </div>
                    <div className="kitchen-report-series__metrics">
                      <span>Orders: {normalizeNumber(point.orders)}</span>
                      <span>Avg: {formatMoneyDisplay(point.avgOrderDisplay, point.avgOrder)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="kitchen-empty-state kitchen-empty-state--compact">
                <span>{graphEmptyMessage}</span>
              </div>
            )}
          </section>

          <section className="card kitchen-report-status">
            <div className="kitchen-report-card-header">
              <div>
                <p className="eyebrow">Status Breakdown</p>
                <h3>Orders by status</h3>
              </div>
              <span className="muted">Source: backend report</span>
            </div>
            <div className="kitchen-report-status-grid">
              {STATUS_ORDER.map((status) => (
                <div key={status} className="kitchen-report-status-chip">
                  <span>{formatStatusLabel(status)}</span>
                  <strong>{normalizeNumber(report?.statusCounts?.[status])}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card kitchen-report-table-card">
            <div className="kitchen-report-card-header">
              <div>
                <p className="eyebrow">{topItemsLabel}</p>
                <h3>Best sellers</h3>
              </div>
              <span className="muted">{items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : 'No items'}</span>
            </div>

            {items.length ? (
              <div className="kitchen-report-table-wrap">
                <table className="kitchen-report-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="kitchen-report-table__right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={String(item.key || item.menuItemId || item.name)}>
                        <td>
                          <strong>{item.name || 'Unnamed item'}</strong>
                        </td>
                        <td className="kitchen-report-table__right">{normalizeNumber(item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="kitchen-empty-state kitchen-empty-state--compact">
                No orders found for the selected period.
              </div>
            )}
          </section>

          <section className="card kitchen-report-breakdown">
            <div className="kitchen-report-card-header">
              <div>
                <p className="eyebrow">Revenue Break Down</p>
                <h3>Gross Sales, Platform Fee, Net Earnings</h3>
              </div>
              {commissionRateLabel ? <span className="muted">Commission {commissionRateLabel}</span> : null}
            </div>
            <div className="kitchen-report-breakdown__rows">
              <div>
                <span>Gross Sales</span>
                <strong>{grossSalesLabel}</strong>
              </div>
              {hasMeaningfulValue(report?.commissionAmountDisplay, report?.commissionAmount) ? (
                <div>
                  <span>{report?.commissionRate != null ? 'Platform Fee' : 'Commission'}</span>
                  <strong>{formatMoneyDisplay(report?.commissionAmountDisplay, report?.commissionAmount)}</strong>
                </div>
              ) : null}
              {hasMeaningfulValue(report?.restaurantNetAmountDisplay, report?.restaurantNetAmount) ? (
                <div className="kitchen-report-breakdown__net">
                  <span>Net Earnings</span>
                  <strong>{formatMoneyDisplay(report?.restaurantNetAmountDisplay, report?.restaurantNetAmount)}</strong>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function ReportLoadingState() {
  return (
    <section className="kitchen-report-loading" aria-label="Loading report">
      <div className="kitchen-report-loading__row">
        <div className="kitchen-report-skeleton kitchen-report-skeleton--hero" />
      </div>
      <div className="kitchen-report-skeleton-grid">
        <div className="kitchen-report-skeleton-card" />
        <div className="kitchen-report-skeleton-card" />
        <div className="kitchen-report-skeleton-card" />
        <div className="kitchen-report-skeleton-card" />
      </div>
      <div className="kitchen-report-skeleton-panel" />
      <div className="kitchen-report-skeleton-panel" />
    </section>
  );
}

function buildReportQuery(rangeMode, customMode, singleDate, rangeFrom, rangeTo) {
  if (rangeMode === 'week') {
    const to = getTodayInputValue();
    return {
      from: getDaysAgoInputValue(6),
      to,
    };
  }

  if (rangeMode === 'month') {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: toDateInputValue(from),
      to: getTodayInputValue(),
    };
  }

  if (rangeMode === 'custom' && customMode === 'range') {
    const from = normalizeDateInput(rangeFrom);
    const to = normalizeDateInput(rangeTo);
    return from <= to ? { from, to } : { from: to, to: from };
  }

  if (rangeMode === 'custom' && customMode === 'date') {
    return { date: normalizeDateInput(singleDate) };
  }

  return { today: true };
}

function getReportContextLabel(report, rangeMode, customMode, singleDate, rangeFrom, rangeTo) {
  if (report?.range?.from && report?.range?.to) {
    const from = formatDisplayDate(report.range.from);
    const to = formatDisplayDate(report.range.to);
    return from === to ? from : `${from} - ${to}`;
  }

  if (rangeMode === 'week' || rangeMode === 'month') {
    const query = buildReportQuery(rangeMode, customMode, singleDate, rangeFrom, rangeTo);
    const from = formatDisplayDate(query.from);
    const to = formatDisplayDate(query.to);
    return from === to ? from : `${from} - ${to}`;
  }

  if (rangeMode === 'custom' && customMode === 'range') {
    const from = formatDisplayDate(normalizeDateInput(rangeFrom));
    const to = formatDisplayDate(normalizeDateInput(rangeTo));
    return from === to ? from : `${from} - ${to}`;
  }

  if (rangeMode === 'custom' && customMode === 'date') {
    return formatDisplayDate(normalizeDateInput(singleDate));
  }

  return 'Today';
}

function formatMoneyDisplay(displayValue, numericValue) {
  if (typeof displayValue === 'string' && displayValue.trim()) {
    return displayValue;
  }

  if (!hasMeaningfulValue(displayValue, numericValue)) {
    return '—';
  }

  const parsed = Number(numericValue);
  return Number.isFinite(parsed) ? formatCurrency(parsed) : '—';
}

function fallbackAverageOrder(totalAmount, orderCount) {
  const total = Number(totalAmount);
  const orders = Number(orderCount);
  if (!Number.isFinite(total) || !Number.isFinite(orders) || orders <= 0) {
    return formatCurrency(0);
  }

  return formatCurrency(total / orders);
}

function hasMeaningfulValue(displayValue, numericValue) {
  if (typeof displayValue === 'string' && displayValue.trim()) {
    return true;
  }
  return numericValue != null && numericValue !== '';
}

function formatDisplayDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(date) {
  if (!date) {
    return '—';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimezoneAbbrev(timezone) {
  if (!timezone) {
    return '';
  }

  try {
    const parts = new Intl.DateTimeFormat([], {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const tzPart = parts.find((part) => part.type === 'timeZoneName');
    return tzPart?.value || timezone;
  } catch {
    return timezone;
  }
}

function normalizeDateInput(value) {
  const input = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : getTodayInputValue();
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysAgoInputValue(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateInputValue(date);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatStatusLabel(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCommissionRateLabel(rate) {
  if (rate == null || rate === '') {
    return '';
  }

  if (typeof rate === 'string' && rate.trim().endsWith('%')) {
    return `(${rate.trim()})`;
  }

  const numeric = Number(rate);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const percentage = numeric <= 1 ? numeric * 100 : numeric;
  const formatted = Number.isInteger(percentage) ? percentage : Number(percentage.toFixed(2));
  return `(${formatted}%)`;
}

function getGraphPointKey(point, index) {
  return point?.date || point?.label || point?.day || `series-${index}`;
}

function formatGraphDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getGraphBarHeight(amount, series) {
  const values = Array.isArray(series) ? series.map((point) => Number(point?.amount ?? 0)).filter((value) => Number.isFinite(value)) : [];
  const max = Math.max(...values, 0);
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 12;
  }
  if (max <= 0) {
    return 12;
  }
  return Math.max(12, (numeric / max) * 100);
}
