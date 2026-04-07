const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCurrency(value) {
  if (typeof value !== 'number') {
    return USD.format(Number(value) || 0);
  }
  return USD.format(value);
}
