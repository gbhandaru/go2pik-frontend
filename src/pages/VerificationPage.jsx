import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { confirmOrderVerification, resendOrderVerification, startOrderVerification } from '../api/ordersApi.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { getCustomerDisplayName } from '../utils/customerIdentity.js';

const VERIFICATION_LENGTH = 4;

export default function VerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const orderDraft = location.state?.orderDraft || null;
  const fallbackCustomerName = location.state?.customerName || '';
  const customerName = getCustomerDisplayName(user) || fallbackCustomerName;
  const [verification, setVerification] = useState(null);
  const [code, setCode] = useState(() => Array.from({ length: VERIFICATION_LENGTH }, () => ''));
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const inputsRef = useRef([]);
  const initialVerificationLoaded = useRef(false);
  const phone = getVerificationPhone(orderDraft, user, verification);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderDraft || authLoading || initialVerificationLoaded.current) {
      return;
    }

    let active = true;
    initialVerificationLoaded.current = true;

    async function requestVerification() {
      const payload = buildVerificationStartPayload(orderDraft, user, customerName);
      if (!payload.customer.phone) {
        if (active) {
          setError('A phone number is required to send the verification code.');
          setStarting(false);
        }
        return;
      }

      setStarting(true);
      setError('');
      try {
        const response = await startOrderVerification(payload);
        if (!active) {
          return;
        }
        setVerification(response?.verification || null);
        setCode(Array.from({ length: VERIFICATION_LENGTH }, () => ''));
        inputsRef.current[0]?.focus();
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to send verification code right now.');
          setVerification(null);
        }
      } finally {
        if (active) {
          setStarting(false);
        }
      }
    }

    requestVerification();

    return () => {
      active = false;
    };
  }, [orderDraft, authLoading, user, customerName]);

  const codeValue = useMemo(() => code.join(''), [code]);
  const isCodeComplete = code.every((digit) => /\d/.test(digit));
  const verificationExpiresAt = parseVerificationDate(verification?.expiresAt);
  const resendAvailableAt = parseVerificationDate(verification?.resendAvailableAt);
  const canResend = !resendAvailableAt || now >= resendAvailableAt.getTime();
  const resendCountdown = canResend ? '' : formatCountdown(resendAvailableAt.getTime() - now);
  const expiryCountdown = verificationExpiresAt ? formatCountdown(verificationExpiresAt.getTime() - now) : '';
  const resendButtonLabel = canResend ? 'Resend Code' : `Resend in ${resendCountdown}`;

  if (!orderDraft) {
    return <Navigate to="/home" replace />;
  }

  const handleChange = (index, value) => {
    const digit = String(value || '').replace(/\D/g, '').slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError('');

    if (digit && index < VERIFICATION_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < VERIFICATION_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, VERIFICATION_LENGTH);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    const next = Array.from({ length: VERIFICATION_LENGTH }, (_, index) => pasted[index] || '');
    setCode(next);
    setError('');
    const focusIndex = Math.min(pasted.length, VERIFICATION_LENGTH - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  const handleResend = () => {
    if (!canResend || starting) {
      return;
    }

    if (!verification?.id) {
      setError('Verification session is missing. Please restart checkout.');
      return;
    }

    setStarting(true);
    setError('');
    resendOrderVerification({
      verificationId: verification.id,
    })
      .then((response) => {
        setVerification(response?.verification || null);
        setCode(Array.from({ length: VERIFICATION_LENGTH }, () => ''));
        inputsRef.current[0]?.focus();
      })
      .catch((err) => {
        setError(err.message || 'Unable to resend verification code right now.');
      })
      .finally(() => {
        setStarting(false);
      });
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!isCodeComplete) {
      setError('Enter the 4-digit code to continue.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await confirmOrderVerification({
        verificationId: verification?.id,
        code: codeValue,
        customer: orderDraft.customer,
        customerName: orderDraft.customerName,
        restaurantId: orderDraft.restaurantId,
        restaurant: orderDraft.restaurant,
        items: orderDraft.items,
        subtotal: orderDraft.subtotal,
        total: orderDraft.total,
      });
      const responseOrder = response?.order || {};
      navigate('/order-confirmation', {
        replace: true,
        state: {
          order: {
            ...response,
            ...responseOrder,
            customer: responseOrder.customer || orderDraft.customer,
            customerName: responseOrder.customer?.name || orderDraft.customerName,
            orderNumber: responseOrder.orderNumber || response?.automation?.confirmationNumber || orderDraft.orderNumber,
            items: responseOrder.items || orderDraft.items,
          },
          customerName: responseOrder.customer?.name || customerName || undefined,
        },
      });
    } catch (err) {
      setError(err.message || 'Unable to verify your order right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-section verification-page">
      <section className="verification-shell">
        <form className="verification-card" onSubmit={handleVerify}>
          <div className="verification-icon" aria-hidden="true">
            <LockIcon />
          </div>
          <h1>Verification Code</h1>
          <p className="verification-lede">Please enter the 4-digit code sent to</p>
          <p className="verification-phone">{phone}</p>
          {verificationExpiresAt ? (
            <div className="verification-meta">
              <p>
                Expires at <strong>{formatVerificationDateTime(verificationExpiresAt)}</strong>
              </p>
              {expiryCountdown ? <p className="muted">Expires in {expiryCountdown}</p> : null}
            </div>
          ) : null}

          <div className="verification-code-row" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(node) => {
                  inputsRef.current[index] = node;
                }}
                className={`verification-code-box${digit ? ' is-filled' : ''}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                aria-label={`Verification digit ${index + 1}`}
              />
            ))}
          </div>

          <p className="verification-resend-copy">Didn&apos;t receive a code?</p>
          <button
            type="button"
            className="verification-resend"
            onClick={handleResend}
            disabled={!canResend || starting}
            aria-describedby="verification-resend-helper"
          >
            {starting ? 'Sending...' : resendButtonLabel}
          </button>
          <p id="verification-resend-helper" className="muted verification-resend-meta">
            {canResend
              ? 'You can request a new code now.'
              : `Resend unlocks in ${resendCountdown}`}
          </p>
          {resendAvailableAt ? (
            <p className="muted verification-resend-meta">
              Resend available at {formatVerificationDateTime(resendAvailableAt)}
            </p>
          ) : null}

          {error ? <p className="error-text verification-error">{error}</p> : null}

          <button className="verification-submit" type="submit" disabled={submitting || starting || !isCodeComplete}>
            {submitting ? 'Verifying…' : starting ? 'Sending code…' : 'Verify'}
          </button>

          <p className="muted verification-note">
            Code entered: {codeValue || '----'} {customerName ? `• ${customerName}` : ''}
          </p>
        </form>
      </section>
    </main>
  );
}

function getVerificationPhone(orderDraft, user, verification) {
  const rawPhone =
    verification?.customerPhone ||
    verification?.customer_phone ||
    orderDraft?.customer?.phone ||
    orderDraft?.customer?.phone_number ||
    user?.phone ||
    user?.phone_number ||
    orderDraft?.customerPhone ||
    '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length >= 10) {
    const country = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '+1 ';
    const area = digits.slice(-10, -7);
    const last = digits.slice(-4);
    return `${country}${area} *** ${last}`.replace(/\s+/g, ' ').trim();
  }
  return '+1 510 *** 8796';
}

function parseVerificationDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatVerificationDateTime(date) {
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCountdown(diffMs) {
  const clamped = Math.max(0, diffMs);
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function buildVerificationStartPayload(orderDraft, user, customerName) {
  const items = Array.isArray(orderDraft?.items)
    ? orderDraft.items.map((item) => ({
        sku: item.sku || item.menuItemId || item.id || item.name,
        quantity: item.quantity || 1,
        notes: item.specialInstructions || item.notes || '',
      }))
    : [];

  const pickupTime =
    orderDraft?.pickupRequest?.scheduledTime ||
    orderDraft?.customer?.pickupTime ||
    orderDraft?.pickupTime ||
    '';

  return {
    restaurantId: orderDraft?.restaurantId || orderDraft?.restaurant?.id,
    items,
    customer: {
      name: customerName || orderDraft?.customer?.name || orderDraft?.customerName || user?.name || user?.full_name || '',
      phone:
        orderDraft?.customer?.phone ||
        orderDraft?.customer?.phone_number ||
        user?.phone ||
        user?.phone_number ||
        '',
      email: orderDraft?.customer?.email || user?.email || '',
      pickupTime: pickupTime || undefined,
      notes: orderDraft?.customer?.notes || orderDraft?.pickupRequest?.summary || '',
    },
  };
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 3a1.5 1.5 0 0 1 .75 2.8V18h-1.5v-2.2A1.5 1.5 0 0 1 12 13Z" />
    </svg>
  );
}
