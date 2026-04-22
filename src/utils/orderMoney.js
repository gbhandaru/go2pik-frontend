import { formatCurrency } from './formatCurrency.js';

export function resolveMoneyDisplay(displayValue, numericValue, fallbackValue = 0) {
  if (typeof displayValue === 'string' && displayValue.trim()) {
    return displayValue.trim();
  }

  const parsedNumeric = Number(numericValue);
  if (Number.isFinite(parsedNumeric)) {
    return formatCurrency(parsedNumeric);
  }

  const parsedFallback = Number(fallbackValue);
  if (Number.isFinite(parsedFallback)) {
    return formatCurrency(parsedFallback);
  }

  return formatCurrency(0);
}
