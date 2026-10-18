// Launch cities for our own places database. bbox is [west, south, east, north].
export const CITIES: Record<string, { name: string; bbox: [number, number, number, number] }> = {
  jaipur: { name: 'Jaipur', bbox: [75.65, 26.75, 76.0, 27.08] },
  udaipur: { name: 'Udaipur', bbox: [73.6, 24.5, 73.82, 24.68] },
};
