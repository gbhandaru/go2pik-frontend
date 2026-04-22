import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AsyncState from '../components/shared/AsyncState.jsx';
import { fetchTwilioVerifyHealth } from '../api/healthApi.js';
import { confirmOrderVerification, resendOrderVerification, startOrderVerification } from '../api/ordersApi.js';
import { updateCustomerPhone } from '../api/authApi.js';
import { ENV } from '../config/env.js';
import { useAuth } from '../hooks/useAuth.jsx';
import {
  clearCustomerOrderDraft,
  clearCustomerOrderVerification,
  getCustomerOrderDraft,
  getCustomerOrderVerification,
  getVerifiedCustomerPhone,
  setVerifiedCustomerPhone,
  storeCustomerOrderDraft,
  storeCustomerOrderVerification,
} from '../services/authStorage.js';
import { getCustomerDisplayName } from '../utils/customerIdentity.js';
import { getRestaurantMenuPath } from '../utils/restaurantRoutes.js';

const DEFAULT_OTP_LENGTH = ENV.OTP_LENGTH;
const VERIFICATION_START_TIMEOUT_MS = 12000;

export default function VerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [orderDraft, setOrderDraft] = useState(() => location.state?.orderDraft || getCustomerOrderDraft() || null);
  const fallbackCustomerName = location.state?.customerName || '';
  const fallbackCustomerPhone = location.state?.customerPhone || '';
  const customerName = getCustomerDisplayName(user) || fallbackCustomerName;
  const [otpLength, setOtpLength] = useState(DEFAULT_OTP_LENGTH);
  const [verification, setVerification] = useState(() => getCustomerOrderVerification() || null);
  const [code, setCode] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(Boolean(location.state?.pendingVerification));
  const [error, setError] = useState('');
  const [startError, setStartError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [now, setNow] = useState(Date.now());
  const inputsRef = useRef([]);
  const lastAutoSubmittedCodeRef = useRef('');
  const resolvedOtpLength = otpLength;
  const phone = getVerificationPhone(orderDraft, user, verification);

  useEffect(() => {
    if (!location.state?.orderDraft) {
      return;
    }

    setOrderDraft(location.state.orderDraft);
    storeCustomerOrderDraft(location.state.orderDraft);
    clearCustomerOrderVerification();
    setVerification(null);
    setStartError('');
    setPendingVerification(Boolean(location.state.pendingVerification));
    setCode([]);
  }, [location.state?.orderDraft]);

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
    if (!verification) {
      clearCustomerOrderVerification();
      return;
    }

    storeCustomerOrderVerification(verification);
  }, [verification]);

  useEffect(() => {
    if (!orderDraft || !resolvedOtpLength || verification || startError) {
      return;
    }

    let active = true;

    async function requestVerification() {
      const resolvedRestaurantId = resolveRestaurantIdForVerification(orderDraft);
      if (resolvedRestaurantId == null) {
        if (active) {
          setStartError('Restaurant information is missing. Please return to the menu and try again.');
        }
        return;
      }

      const payload = buildVerificationStartPayload(orderDraft, customerName, fallbackCustomerPhone, user);
      if (!payload.customer.phone) {
        if (active) {
          setStartError('A phone number is required to send the verification code.');
        }
        return;
      }

      setStarting(true);
      setError('');
      try {
        const response = await withTimeout(
          startOrderVerification(payload),
          VERIFICATION_START_TIMEOUT_MS,
          'Verification is taking longer than expected. Please retry from the menu.',
        );
        if (!active) {
          return;
        }
        setVerification(response?.verification || null);
        setPendingVerification(false);
        setCode(Array.from({ length: resolvedOtpLength }, () => ''));
        inputsRef.current[0]?.focus();
      } catch (err) {
        if (active) {
          setStartError(
            getPickupValidationMessage(err) ||
              err.message ||
              'Unable to send verification code right now.',
          );
          setVerification(null);
          setPendingVerification(false);
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
  }, [orderDraft, resolvedOtpLength, verification, retryKey, customerName, fallbackCustomerPhone, startError, user]);

  const codeValue = useMemo(() => code.join(''), [code]);
  const isCodeComplete = code.every((digit) => /\d/.test(digit));
  const verificationExpiresAt = parseVerificationDate(verification?.expiresAt);
  const resendAvailableAt = parseVerificationDate(verification?.resendAvailableAt);
  const canResend = !resendAvailableAt || now >= resendAvailableAt.getTime();
  const resendCountdown = canResend ? '' : formatCountdown(resendAvailableAt.getTime() - now);
  const expiryCountdown = verificationExpiresAt ? formatCountdown(verificationExpiresAt.getTime() - now) : '';

  useEffect(() => {
    if (!verification?.id || !isCodeComplete || submitting || starting) {
      return;
    }

    if (lastAutoSubmittedCodeRef.current === codeValue) {
      return;
    }

    lastAutoSubmittedCodeRef.current = codeValue;
    void submitVerification();
  }, [codeValue, isCodeComplete, verification?.id, submitting, starting]);

  useEffect(() => {
    if (!isCodeComplete) {
      lastAutoSubmittedCodeRef.current = '';
    }
  }, [codeValue, isCodeComplete]);

  const handleRetryDraft = () => {
    setOrderDraft(getCustomerOrderDraft());
    setVerification(getCustomerOrderVerification() || null);
    setStartError('');
  };

  const handleRetryStart = () => {
    clearCustomerOrderVerification();
    setVerification(null);
    setStartError('');
    setRetryKey((current) => current + 1);
  };

  const handleBackToMenu = () => {
    const menuPath = getRestaurantMenuPath(orderDraft?.restaurantRouteKey || orderDraft?.restaurant || orderDraft?.restaurantId);
    if (menuPath !== '/home') {
      navigate(menuPath, { replace: true });
      return;
    }

    navigate('/home', { replace: true });
  };

  if (!orderDraft) {
    return (
      <main className="page-section">
        <AsyncState
          title="Order draft unavailable"
          message="We could not restore your order. Retry to load the saved draft or return to the restaurant list."
          primaryActionLabel="Retry"
          onPrimaryAction={handleRetryDraft}
          secondaryActionLabel="Back to restaurant list"
          onSecondaryAction={() => navigate('/home')}
        />
      </main>
    );
  }

  if (!orderDraft || !resolvedOtpLength || (pendingVerification && !verification && !startError)) {
    return (
      <main className="page-section verification-page">
        <section className="verification-shell">
          <AsyncState
            title="Sending verification code"
            message="Please wait while we set up your one-time code."
            loading
          />
        </section>
      </main>
    );
  }

  if (startError && !verification) {
    return (
      <main className="page-section">
        <AsyncState
          title="Verification unavailable"
          message={startError}
          primaryActionLabel="Retry"
          onPrimaryAction={handleRetryStart}
          secondaryActionLabel={orderDraft?.restaurantId || orderDraft?.restaurant?.id ? 'Back to menu' : 'Back to restaurant list'}
          onSecondaryAction={handleBackToMenu}
        />
      </main>
    );
  }

  const handleChange = (index, value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) {
      setCode((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      setError('');
      return;
    }

    setCode((prev) => {
      const next = [...prev];
      const nextDigits = digits.slice(0, resolvedOtpLength - index).split('');
      nextDigits.forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      return next;
    });
    setError('');

    const nextFocusIndex = Math.min(index + digits.length, resolvedOtpLength - 1);
    if (digits.length > 0 && nextFocusIndex < resolvedOtpLength) {
      inputsRef.current[nextFocusIndex]?.focus();
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

  async function submitVerification() {
    if (!verification?.id || submitting || starting) {
      return;
    }

    if (!isCodeComplete) {
      setError(`Enter the ${resolvedOtpLength}-digit code to continue.`);
      return;
    }

    const resolvedRestaurantId = resolveRestaurantIdForVerification(orderDraft);
    if (resolvedRestaurantId == null) {
      setError('Restaurant information is missing. Please return to the menu and try again.');
      return;
    }

    const resolvedPhone = resolveVerificationPhone(orderDraft, fallbackCustomerPhone, user);
    if (!resolvedPhone) {
      setError('A phone number is required to send the verification code.');
      return;
    }

    lastAutoSubmittedCodeRef.current = codeValue;
    setSubmitting(true);
    setError('');
    try {
      const response = await confirmOrderVerification({
        verificationId: verification?.id,
        code: codeValue,
        customer: {
          ...(orderDraft.customer || {}),
          phone: resolvedPhone,
        },
        customerName: orderDraft.customerName,
        restaurantId: resolvedRestaurantId,
        restaurant: orderDraft.restaurant,
        items: orderDraft.items,
        subtotal: orderDraft.subtotal,
        total: orderDraft.total,
      });
      const responseOrder = response?.order || {};
      clearCustomerOrderDraft();
      clearCustomerOrderVerification();
      persistVerifiedPhone(orderDraft?.customer?.phone, user);
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
      setError(getPickupValidationMessage(err) || err.message || 'Unable to verify your order right now.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleResend = () => {
    if (!canResend || starting) {
      return;
    }

    if (!verification?.id) {
      setError('Verification session is missing. Please restart from the menu.');
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
    await submitVerification();
  };

  return (
    <main className="page-section verification-page">
      <section className="verification-shell">
        <form className="verification-card" onSubmit={handleVerify}>
          <button type="button" className="verification-card__close" onClick={handleBackToMenu} aria-label="Change number">
            ×
          </button>
          <div className="verification-icon" aria-hidden="true">
            <LockIcon />
          </div>
          <h1>Enter the code</h1>
          <p className="verification-lede">We&apos;ve sent a {resolvedOtpLength}-digit code to</p>
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

          <button className="verification-submit" type="submit" disabled={submitting || starting || !isCodeComplete}>
            {submitting ? 'Verifying…' : starting ? 'Sending code…' : 'Confirm Order'}
          </button>

          <p className="verification-resend-copy">
            Didn&apos;t get it? {canResend ? 'Resend code now' : `Resend code in ${resendCountdown}`}
          </p>
          <button
            type="button"
            className="verification-resend"
            onClick={handleResend}
            disabled={!canResend || starting}
          >
            {starting ? 'Sending...' : 'Resend code'}
          </button>

          <button type="button" className="verification-change-number" onClick={handleBackToMenu}>
            <span aria-hidden="true">←</span>
            <span>Change number</span>
          </button>

          {error ? <p className="error-text verification-error">{error}</p> : null}
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
  return '';
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

function getPickupValidationMessage(error) {
  const code = String(error?.code || '').trim();
  if (code === 'pickup_time_out_of_hours') {
    return 'Pickup time is outside restaurant open hours. Please choose another time.';
  }
  if (code === 'pickup_time_required') {
    return 'Please choose a pickup time to continue.';
  }
  return '';
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => {
      window.clearTimeout(timeoutId);
    }),
    timeoutPromise,
  ]);
}

function buildVerificationStartPayload(orderDraft, customerName, customerPhone, user) {
  const restaurantId = resolveRestaurantIdForVerification(orderDraft);
  const items = Array.isArray(orderDraft?.items)
    ? orderDraft.items.map((item) => ({
        id: item.id ?? item.menuItemId ?? item.menu_item_id ?? item.sku ?? '',
        menuItemId: item.menuItemId ?? item.menu_item_id ?? item.id ?? '',
        sku: item.sku ?? item.code ?? '',
        name: item.name || item.title || item.label || '',
        quantity: item.quantity || 1,
        notes: item.notes || item.specialInstructions || '',
      }))
    : [];

  const pickupTime =
    orderDraft?.pickupRequest?.scheduledTime ||
    orderDraft?.customer?.pickupTime ||
    orderDraft?.pickupTime ||
    '';
  const normalizedPhone = resolveVerificationPhone(orderDraft, customerPhone, user);

  return {
    restaurantId,
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

function resolveVerificationPhone(orderDraft, customerPhone, user) {
  return normalizeE164Phone(
    customerPhone ||
      orderDraft?.customer?.phone ||
      orderDraft?.customer?.phone_number ||
      orderDraft?.customerPhone ||
      orderDraft?.phone ||
      user?.phone ||
      user?.phone_number ||
      getVerifiedCustomerPhone() ||
      '',
  );
}

function resolveRestaurantIdForVerification(orderDraft) {
  const candidates = [
    orderDraft?.restaurantId,
    orderDraft?.restaurant?.id,
    orderDraft?.restaurant?.restaurantId,
    orderDraft?.restaurant?.restaurant_id,
  ];

  for (const candidate of candidates) {
    const resolved = normalizeRestaurantId(candidate);
    if (resolved != null) {
      return resolved;
    }
  }

  return null;
}

function normalizeRestaurantId(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const input = String(value).trim();
  if (!input) {
    return null;
  }

  if (!/^\d+$/.test(input)) {
    return null;
  }

  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
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

function persistVerifiedPhone(phone, user) {
  const normalizedPhone = normalizeE164Phone(phone);
  const currentPhone = normalizeE164Phone(user?.phone || user?.phone_number || '');
  if (!user || !normalizedPhone || normalizedPhone === currentPhone) {
    return;
  }

  const profile = {
    ...user,
    phone: normalizedPhone,
  };

  updateCustomerPhone({ phone: normalizedPhone })
    .then((response) => {
      const updatedProfile = response?.customer || profile;
      setVerifiedCustomerPhone(updatedProfile?.phone || normalizedPhone);
      window.dispatchEvent(new CustomEvent('go2pik:auth-updated', { detail: { profile: updatedProfile } }));
    })
    .catch((error) => {
      console.warn('Failed to persist verified customer phone', error);
    });
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 3a1.5 1.5 0 0 1 .75 2.8V18h-1.5v-2.2A1.5 1.5 0 0 1 12 13Z" />
    </svg>
  );
}
