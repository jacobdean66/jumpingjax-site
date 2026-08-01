import {
  loadAdminFacilityBookings,
  loadAdminRentalBookings,
  todayYmd,
} from "./operations";
import { loadAdminDeliveries } from "./deliveries";
import { rentalAppearsInActiveSchedule } from "@/lib/bookings/rental-lifecycle";

export type AdminTask = {
  category: string;
  priority: "High" | "Normal" | "Low";
  due: string;
  owner: string;
  customer: string;
  detail: string;
  action: string;
};

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function itemList(items: { rental_name: string }[]) {
  return items.map((item) => item.rental_name).join(", ");
}

export async function loadAdminTaskAutomation(input?: {
  from?: string;
  to?: string;
}): Promise<{ from: string; to: string; tasks: AdminTask[] }> {
  const from = input?.from ?? todayYmd();
  const to = input?.to ?? addDays(from, 7);
  const [{ bookings: rentals }, { bookings: facility }, deliveries] =
    await Promise.all([
      loadAdminRentalBookings({ from, to, status: "all" }),
      loadAdminFacilityBookings({ from, to, status: "all" }),
      loadAdminDeliveries(from),
    ]);

  const activeRentals = rentals.filter((booking) =>
    rentalAppearsInActiveSchedule(booking.status),
  );
  const tasks: AdminTask[] = [];

  for (const booking of activeRentals) {
    tasks.push({
      category: "Daily delivery checklist",
      priority: booking.eventDate === from ? "High" : "Normal",
      due: booking.eventDate,
      owner: "Driver",
      customer: booking.customerName,
      detail: `${itemList(booking.items)} - ${booking.eventAddress ?? "Address needed"}`,
      action: "Confirm address, setup surface, access, straps/sandbags, and customer contact.",
    });

    if (!booking.paymentConfirmedAt) {
      tasks.push({
        category: "Missing payment/deposit",
        priority: "High",
        due: booking.eventDate,
        owner: "Driver",
        customer: booking.customerName,
        detail: `${booking.paymentMethod ?? "Payment"} has not been confirmed by a driver.`,
        action: "Driver confirms payment received in the driver app at delivery.",
      });
    }

    if (booking.status === "pending") {
      tasks.push({
        category: "Unconfirmed booking reminder",
        priority: "High",
        due: booking.eventDate,
        owner: "Office",
        customer: booking.customerName,
        detail: `${itemList(booking.items)} is still pending.`,
        action: "Contact customer or approve/reject before route is finalized.",
      });
    }
  }

  for (const booking of facility) {
    if (booking.status === "pending") {
      tasks.push({
        category: "Unconfirmed booking reminder",
        priority: "Normal",
        due: booking.readableDate ?? from,
        owner: "Office",
        customer: booking.customerName,
        detail: `${booking.partyLabel ?? "Facility party"} is still pending.`,
        action: "Confirm party, add-ons, room, and deposit timing.",
      });
    }

    if (!booking.depositAcknowledged) {
      tasks.push({
        category: "Missing payment/deposit",
        priority: "Normal",
        due: booking.readableDate ?? from,
        owner: "Office",
        customer: booking.customerName,
        detail: "Facility deposit acknowledgement is not checked.",
        action: "Follow up on $50 deposit requirement.",
      });
    }
  }

  for (const booking of deliveries.bookings) {
    const truck = booking.deliveryTruck ?? booking.items.find((item) => item.deliveryTruck)?.deliveryTruck;
    if (!truck) {
      tasks.push({
        category: "Driver assignment reminder",
        priority: "High",
        due: booking.eventDate,
        owner: "Route planner",
        customer: booking.customerName,
        detail: `${itemList(booking.items)} has no truck assigned.`,
        action: "Assign truck and save route plan.",
      });
    }

    const status =
      booking.deliveryRouteStatus ??
      booking.items.find((item) => item.deliveryRouteStatus)?.deliveryRouteStatus ??
      "planned";
    if (booking.eventDate === from && status !== "picked-up") {
      tasks.push({
        category: "End-of-day pickup completion",
        priority: "High",
        due: booking.eventDate,
        owner: "Driver",
        customer: booking.customerName,
        detail: `${itemList(booking.items)} status is ${status}.`,
        action: "Confirm pickup complete in the driver app before closeout.",
      });
    }

    tasks.push({
      category: "Inventory prep list",
      priority: "Normal",
      due: booking.eventDate,
      owner: "Warehouse",
      customer: booking.customerName,
      detail: itemList(booking.items),
      action: "Pull, inspect, clean, and stage items by truck/load order.",
    });
  }

  return { from, to, tasks };
}
