import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { fetchTwilioVerifyHealth } from '../api/healthApi.js';
import { confirmOrderVerification, resendOrderVerification, startOrderVerification } from '../api/ordersApi.js';
import { ENV } from '../config/env.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { getCustomerDisplayName } from '../utils/customerIdentity.js';

const DEFAULT_OTP_LENGTH = ENV.OTP_LENGTH;

export default function VerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const orderDraft = location.state?.orderDraft || null;
  const fallbackCustomerName = location.state?.customerName || '';
  const fallbackCustomerPhone = location.state?.customerPhone || '';
  const customerName = getCustomerDisplayName(user) || fallbackCustomerName;
  const [otpLength, setOtpLength] = useState(null);
  const [verification, setVerification] = useState(null);
  const [code, setCode] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const inputsRef = useRef([]);
  const initialVerificationLoaded = useRef(false);
  const resolvedOtpLength = otpLength;
  const phone = getVerificationPhone(orderDraft, user, verification);

  useEffect(() => {
    let active = true;

    async function loadOtpLength() {
      try {
        const response = await fetchTwilioVerifyHealth();
        if (!active) {
          return;
        }
        const nextLength = normalizePositiveInteger(response?.otpLength ?? response?.serviceDetails?.codeLength, DEFAULT_OTP_LENGTH);
        setOtpLength(nextLength);
      } catch {
        if (active) {
          setOtpLength(DEFAULT_OTP_LENGTH);
        }
      }
    }

    loadOtpLength();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!resolvedOtpLength) {
      return;
    }
    setCode(Array.from({ length: resolvedOtpLength }, () => ''));
  }, [resolvedOtpLength]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderDraft || authLoading || !resolvedOtpLength || initialVerificationLoaded.current) {
      return;
    }

    let active = true;
    initialVerificationLoaded.current = true;

    async function requestVerification() {
      const payload = buildVerificationStartPayload(orderDraft, customerName, fallbackCustomerPhone);
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
        setCode(Array.from({ length: resolvedOtpLength }, () => ''));
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
  }, [orderDraft, authLoading, resolvedOtpLength, user, customerName]);

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

  if (!resolvedOtpLength) {
    return (
      <main className="page-section verification-page">
        <section className="verification-shell">
          <div className="verification-card">
            <p className="muted">Loading verification settings...</p>
          </div>
        </section>
      </main>
    );
  }

  const handleChange = (index, value) => {
    const digit = String(value || '').replace(/\D/g, '').slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError('');

    if (digit && index < resolvedOtpLength - 1) {
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
    if (event.key === 'ArrowRight' && index < resolvedOtpLength - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, resolvedOtpLength);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    const next = Array.from({ length: resolvedOtpLength }, (_, index) => pasted[index] || '');
    setCode(next);
    setError('');
    const focusIndex = Math.min(pasted.length, resolvedOtpLength - 1);
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
        setCode(Array.from({ length: resolvedOtpLength }, () => ''));
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
      setError(`Enter the ${resolvedOtpLength}-digit code to continue.`);
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
          <p className="verification-lede">Please enter the {resolvedOtpLength}-digit code sent to</p>
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
          >
            {starting ? 'Sending...' : resendButtonLabel}
          </button>

          {error ? <p className="error-text verification-error">{error}</p> : null}

          <button className="verification-submit" type="submit" disabled={submitting || starting || !isCodeComplete}>
            {submitting ? 'Verifying…' : starting ? 'Sending code…' : 'Confirm Order'}
          </button>
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
  return '+1 510 *** 7548';
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

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildVerificationStartPayload(orderDraft, customerName, customerPhone) {
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
  const normalizedPhone = normalizeE164Phone(
    customerPhone ||
    orderDraft?.customer?.phone ||
    orderDraft?.customer?.phone_number ||
    '',
  );

  return {
    restaurantId: orderDraft?.restaurantId || orderDraft?.restaurant?.id,
    items,
    customer: {
      name: customerName || orderDraft?.customer?.name || orderDraft?.customerName || '',
      phone: normalizedPhone,
      email: orderDraft?.customer?.email || '',
      pickupTime: pickupTime || undefined,
      notes: orderDraft?.customer?.notes || orderDraft?.pickupRequest?.summary || '',
    },
  };
}

function normalizeE164Phone(value) {
  const input = String(value || '').trim();
  if (!input) {
    return '';
  }

  if (input.startsWith('+')) {
    const digits = input.replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  const digits = input.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 3a1.5 1.5 0 0 1 .75 2.8V18h-1.5v-2.2A1.5 1.5 0 0 1 12 13Z" />
    </svg>
  );
}
