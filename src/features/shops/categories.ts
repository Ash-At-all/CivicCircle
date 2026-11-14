export const SHOP_CATEGORIES = [
  "food",
  "grocery",
  "pharmacy",
  "health",
  "education",
  "services",
  "repair",
  "salon",
  "hardware",
  "clothing",
  "electronics",
  "transport",
  "other",
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const SHOP_CATEGORY_LABELS: Record<ShopCategory | "all", string> = {
  all: "All categories",
  food: "Food",
  grocery: "Grocery",
  pharmacy: "Pharmacy",
  health: "Health",
  education: "Education",
  services: "Services",
  repair: "Repair",
  salon: "Salon",
  hardware: "Hardware",
  clothing: "Clothing",
  electronics: "Electronics",
  transport: "Transport",
  other: "Other",
};
