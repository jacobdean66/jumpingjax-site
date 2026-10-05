export const DRIVER_MOBILE_SESSION_COOKIE = "jumpingjax-driver-mobile-session";
export const DRIVER_VEHICLES = [{ id: "dodge", label: "Dodge" }, { id: "ford", label: "Ford" }] as const;
export type DriverVehicle = "dodge" | "ford";
export type DriverTrailer = "truck-1" | "truck-2";
export function isDriverVehicle(value: unknown): value is DriverVehicle {
  return value === "dodge" || value === "ford";
}
export function isDriverTrailer(value: unknown): value is DriverTrailer {
  return value === "truck-1" || value === "truck-2";
}
export function equipmentLabel(vehicle: string | null, trailer: string | null): string {
  return [vehicle === "dodge" ? "Dodge" : vehicle === "ford" ? "Ford" : "Truck not recorded",
    trailer === "truck-1" ? "Short Trailer" : trailer === "truck-2" ? "Long Trailer" : "Trailer not recorded"].join(" · ");
}
