export type NearbyShop = {
  id: string;
  name: string;
  name_hi: string | null;
  category: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  lat: number;
  lng: number;
  distance_m: number;
  source: "osm" | "community" | string;
  source_url: string | null;
  last_verified_at: string | null;
};

export type PeopleBucket = {
  radius_m: number;
  active_people: number;
};

export type NearbyResponse = {
  centroid: { lat: number; lng: number };
  localityName?: string;
  shops: NearbyShop[];
  people: PeopleBucket[];
  showPresence: boolean;
  areaIds?: { locality: string; ward: string; city: string };
};
