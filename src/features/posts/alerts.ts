import { z } from "zod";

export const POST_ALERT_TYPES = [
  "water_cut",
  "power_cut",
  "road_closed",
  "traffic_jam",
  "shop_closed",
  "event",
  "safety_notice",
] as const;

export type PostAlertType = (typeof POST_ALERT_TYPES)[number];

export const postAlertTypeSchema = z.enum(POST_ALERT_TYPES).nullable().optional();

export const POST_ALERT_LABELS: Record<PostAlertType, string> = {
  water_cut: "💧 Water Cut",
  power_cut: "⚡ Power Cut",
  road_closed: "🚧 Road Closed",
  traffic_jam: "🚗 Traffic Jam",
  shop_closed: "🏪 Shop Closed",
  event: "📅 Event",
  safety_notice: "⚠️ Safety Notice",
};

export const POST_ALERT_BADGE_CLASS: Record<PostAlertType, string> = {
  water_cut: "badge badge-info",
  power_cut: "badge badge-warning",
  road_closed: "badge badge-warning",
  traffic_jam: "badge badge-danger",
  shop_closed: "badge badge-success",
  event: "badge badge-info",
  safety_notice: "badge badge-danger",
};

export function isPostAlertType(value: unknown): value is PostAlertType {
  return typeof value === "string" && (POST_ALERT_TYPES as readonly string[]).includes(value);
}
