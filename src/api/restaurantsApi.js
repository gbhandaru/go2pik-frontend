import { fetchRestaurants as fetchAllRestaurants, fetchRestaurantMenu } from './ordersApi.js';

export { fetchRestaurantMenu };

export function fetchRestaurants() {
  return fetchAllRestaurants();
}
