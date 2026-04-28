const PROMO_REASON_MESSAGES = {
  PROMO_NOT_FOUND: 'Promo code was not found',
  PROMO_INACTIVE: 'Promo code is inactive',
  PROMO_RESTAURANT_MISMATCH: 'Promo code is not valid for this restaurant',
  PROMO_OUTSIDE_VALIDITY_WINDOW: 'Promo code is not active right now',
  PROMO_MIN_ORDER_NOT_MET: 'Minimum order amount not met',
  PROMO_ALREADY_USED: 'Promo code has already been used for this phone number',
  PROMO_USAGE_LIMIT_REACHED: 'Promo code usage limit has been reached',
  PROMO_DISCOUNT_ZERO: 'Promo code does not apply to this order total',
};

export function getPromoMessageFromReasonCode(reasonCode) {
  if (!reasonCode) {
    return '';
  }

  return PROMO_REASON_MESSAGES[String(reasonCode).trim()] || '';
}

export function resolvePromoValidationMessage(validation) {
  if (!validation || typeof validation !== 'object') {
    return '';
  }

  const reasonMessage = getPromoMessageFromReasonCode(validation.reasonCode);
  if (reasonMessage) {
    return reasonMessage;
  }

  return String(validation.message || '').trim();
}

