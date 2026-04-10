export const mockRestaurants = [
  {
    id: 'brunch-lab',
    name: 'Brunch Lab',
    cuisine: 'Modern American',
    rating: 4.8,
    eta: '25-35 min',
    heroImage:
      'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80',
    menu: [
      { id: 'avocado-toast', name: 'Avocado Toast Stack', price: 14 },
      { id: 'pancake-flight', name: 'Flight of Pancakes', price: 17 },
      { id: 'sunrise-bowl', name: 'Sunrise Power Bowl', price: 15 },
    ],
  },
  {
    id: 'sushi-garden',
    name: 'Sushi Garden',
    cuisine: 'Japanese',
    rating: 4.6,
    eta: '35-45 min',
    heroImage:
      'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=800&q=80',
    menu: [
      { id: 'salmon-nigiri', name: 'Salmon Nigiri', price: 18 },
      { id: 'chef-roll', name: 'Chef Special Roll', price: 21 },
      { id: 'miso-ramen', name: 'Miso Ramen Bowl', price: 16 },
    ],
  },
  {
    id: 'clay-pot',
    name: 'Clay Pot Kitchen',
    cuisine: 'Thai Fusion',
    rating: 4.7,
    eta: '20-30 min',
    heroImage:
      'https://images.unsplash.com/photo-1487511657396-0cacd402f187?auto=format&fit=crop&w=800&q=80',
    menu: [
      { id: 'green-curry', name: 'Green Curry', price: 19 },
      { id: 'pad-thai', name: 'Tamarind Pad Thai', price: 17 },
      { id: 'coconut-rice', name: 'Coconut Sticky Rice', price: 9 },
    ],
  },
];

export const mockOrders = [
  {
    id: 'ord-1841',
    restaurant: mockRestaurants[0],
    total: 42,
    status: 'preparing',
    placedAt: '2024-04-01T16:30:00.000Z',
  },
  {
    id: 'ord-1842',
    restaurant: mockRestaurants[2],
    total: 57,
    status: 'delivered',
    placedAt: '2024-04-02T12:15:00.000Z',
  },
];
