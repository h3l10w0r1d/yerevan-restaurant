// Mirrors backend/app/config.py — weekday 0 = Monday.
export const RESTAURANT = {
  address: 'Kampstraat 22',
  city: 'Hilversum',
  email: 'info@yerevanrestaurant.nl',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Kampstraat+22+Hilversum',
  hours: [
    null,
    ['17:00', '22:00'],
    ['17:00', '22:00'],
    ['17:00', '22:00'],
    ['17:00', '23:00'],
    ['16:00', '23:00'],
    ['16:00', '22:00'],
  ] as ([string, string] | null)[],
  maxParty: 12,
}
