import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { acceptReviewedOrder, cancelReviewedOrder, fetchOrderReview } from '../api/ordersApi.js';
import CustomerPartialOrderModal from '../components/shared/CustomerPartialOrderModal.jsx';
import AsyncState from '../components/shared/AsyncState.jsx';
import { formatCurrency } from '../utils/formatCurrency.js';

export default function OrderReviewPage() {
  const navigate = useNavigate();
  const { orderNumber: routeOrderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const orderNumber = routeOrderNumber || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewOrder, setReviewOrder] = useState(null);
  const [review, setReview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const linkIsValid = Boolean(orderNumber && token);

  useEffect(() => {
    let active = true;

    async function loadReview() {
      if (!linkIsValid) {
        setLoading(false);
        setError('This review link is missing the order number or token. Please open the latest SMS link.');
        return;
      }

      setLoading(true);
      setError('');
      setActionMessage('');

      try {
        const response = await fetchOrderReview(orderNumber, token);
        if (!active) {
          return;
        }
        setReviewOrder(response?.order || null);
        setReview(response?.review || null);
      } catch (err) {
        if (active) {
          setError(err?.message || 'Unable to load order review right now.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReview();

    return () => {
      active = false;
    };
  }, [linkIsValid, orderNumber, token]);

  const restaurantName = reviewOrder?.restaurant?.name || 'your restaurant';
  const canAccept = review?.canAccept !== false;
  const canCancel = review?.canCancel !== false;
  const pendingPartial = isPendingPartialCustomerAction(reviewOrder);
  const acceptedItems = useMemo(() => normalizeItems(reviewOrder?.acceptedItems || reviewOrder?.accepted_items), [reviewOrder]);
  const unavailableItems = useMemo(() => normalizeItems(reviewOrder?.unavailableItems || reviewOrder?.unavailable_items), [reviewOrder]);

  const handleAcceptUpdatedOrder = async () => {
    if (!orderNumber || !token || !canAccept || submitting) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await acceptReviewedOrder(orderNumber, token);
      const updatedOrder = response?.order || reviewOrder;
      setReviewOrder(updatedOrder);
      setActionMessage(response?.message || 'Updated order accepted successfully');
    } catch (err) {
      setError(err?.message || 'Unable to accept the updated order right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelUpdatedOrder = async () => {
    if (!orderNumber || !token || !canCancel || submitting) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await cancelReviewedOrder(orderNumber, token, 'Please cancel the order');
      const updatedOrder = response?.order || reviewOrder;
      setReviewOrder(updatedOrder);
      setActionMessage(response?.message || 'Order cancelled successfully');
    } catch (err) {
      setError(err?.message || 'Unable to cancel the order right now.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="page-section">
        <AsyncState title="Loading your order update" message="Please wait while we open the SMS review link." loading />
      </main>
    );
  }

  if (!linkIsValid) {
    return (
      <main className="page-section">
        <AsyncState
          title="Invalid SMS link"
          message="This SMS link is missing the order number or token. Please open the latest message."
          secondaryActionLabel="Go home"
          onSecondaryAction={() => navigate('/')}
        />
      </main>
    );
  }

  if (error && !reviewOrder) {
    return (
      <main className="page-section">
        <AsyncState
          title="Order update unavailable"
          message={error}
          primaryActionLabel="Retry"
          onPrimaryAction={() => window.location.reload()}
          secondaryActionLabel="Go home"
          onSecondaryAction={() => navigate('/')}
        />
      </main>
    );
  }

  if (actionMessage) {
    return (
      <main className="page-section">
        <AsyncState
          title={actionMessage}
          message={`Order ${orderNumber} for ${restaurantName} has been updated.`}
          secondaryActionLabel="Go home"
          onSecondaryAction={() => navigate('/')}
        >
          <div className="order-review-success-card card">
            <div>
              <span>Order #</span>
              <strong>{orderNumber}</strong>
            </div>
            <div>
              <span>Restaurant</span>
              <strong>{restaurantName}</strong>
            </div>
            <div>
              <span>Updated total</span>
              <strong>{formatReviewTotal(reviewOrder)}</strong>
            </div>
            <div className="order-review-success-card__items">
              <div>
                <span>Accepted items</span>
                <strong>{acceptedItems.length || 0}</strong>
              </div>
              <div>
                <span>Unavailable items</span>
                <strong>{unavailableItems.length || 0}</strong>
              </div>
            </div>
          </div>
        </AsyncState>
      </main>
    );
  }

  return (
    <main className="page-section order-review-page">
      {pendingPartial && reviewOrder ? (
        <p className="order-review-page__eyebrow">Text message order update</p>
      ) : null}
      {pendingPartial && reviewOrder ? (
        <CustomerPartialOrderModal
          order={reviewOrder}
          onAcceptUpdatedOrder={handleAcceptUpdatedOrder}
          onCancelOrder={handleCancelUpdatedOrder}
          submitting={submitting}
          error={error}
          acceptLabel="Accept Updated Order"
          cancelLabel="Cancel Complete Order"
          canAccept={canAccept}
          canCancel={canCancel}
        />
      ) : (
        <AsyncState
          title="No action needed"
          message="This order is no longer waiting for your review."
          secondaryActionLabel="Go home"
          onSecondaryAction={() => navigate('/')}
        />
      )}
    </main>
  );
}

function isPendingPartialCustomerAction(order) {
  if (!order) {
    return false;
  }

  const acceptanceMode = String(order.acceptanceMode || order.acceptance_mode || '').trim().toLowerCase();
  if (acceptanceMode !== 'partial') {
    return false;
  }

  const action = String(order.customerAction || order.customer_action || '').trim().toLowerCase();
  return !action || action === 'pending';
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(Boolean).map((item, index) => ({
    ...item,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    __fallbackKey: item.id || item.menuItemId || item.name || `item-${index}`,
  }));
}

function formatReviewTotal(order) {
  const displayCandidates = [
    order?.payableAmountDisplay,
    order?.estimatedTotalDisplay,
    order?.finalAmountDisplay,
    order?.totalDisplay,
  ];
  for (const candidate of displayCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const numericCandidates = [order?.payableAmount, order?.finalAmount];
  for (const candidate of numericCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return formatCurrency(candidate);
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return formatCurrency(parsed);
      }
    }
  }

  const items = normalizeItems(order?.acceptedItems || order?.accepted_items);
  if (items.length) {
    return formatCurrency(items.reduce((sum, item) => sum + getLineTotal(item), 0));
  }

  return formatCurrency(0);
}

function getLineTotal(item) {
  const quantity = Number(item?.quantity) > 0 ? Number(item.quantity) : 1;
  const price = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0);
  return quantity * (Number.isFinite(price) ? price : 0);
}
