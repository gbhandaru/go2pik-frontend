export function formatRestaurantAddress(restaurant) {
  const { line1, secondary } = getRestaurantAddressLines(restaurant);
  return [line1, secondary].filter(Boolean).join(' • ');
}

export function getRestaurantAddressLines(restaurant) {
  if (!restaurant) {
    return { line1: '', secondary: '' };
  }

  const nestedAddress = typeof restaurant.address === 'object' && restaurant.address ? restaurant.address : null;
  const line1 =
    nestedAddress?.line1 ||
    nestedAddress?.address_line1 ||
    nestedAddress?.addressLine1 ||
    nestedAddress?.street ||
    restaurant.address_line1 ||
    restaurant.addressLine1 ||
    restaurant.address1 ||
    restaurant.street ||
    '';
  const city = nestedAddress?.city || restaurant.city || '';
  const state = nestedAddress?.state || restaurant.state || '';
  const formatted =
    nestedAddress?.formatted ||
    nestedAddress?.formattedAddress ||
    restaurant.formatted ||
    restaurant.formattedAddress ||
    restaurant.formatted_address ||
    '';
  const cityState = [city, state].filter(Boolean).join(', ');
  const trailing = formatted || cityState;

  return {
    line1,
    secondary: trailing,
  };
}
