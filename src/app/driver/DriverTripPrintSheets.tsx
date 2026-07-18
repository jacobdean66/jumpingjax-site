import type { AdminDeliveryBooking, AdminDeliveryWorkTask } from "@/lib/admin/deliveries";
import {
  buildTripEquipmentItems,
  driverStatusLabel,
  driverTripPrintSheetId,
  driverWorkTypeLongLabel,
  formatDriverMobileDate,
  formatDriverMobileTime,
  tripScheduleLabel,
} from "@/lib/admin/driver-mobile";

export function DriverTripPrintSheets({
  tasks,
  bookings,
}: {
  tasks: AdminDeliveryWorkTask[];
  bookings: AdminDeliveryBooking[];
}) {
  if (tasks.length === 0) return null;
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));

  return (
    <section
      className="driver-print-only driver-trip-print-sheets"
      aria-label="Printable single-trip sheets"
    >
      {tasks.map((task) => {
        const sheetId = driverTripPrintSheetId(task);
        const booking = bookingById.get(task.bookingId);
        const equipment = buildTripEquipmentItems({ task, booking });
        return (
          <article
            key={sheetId}
            id={sheetId}
            className="driver-trip-print-sheet driver-print-sheet-skip"
            data-task-id={task.id}
            data-work-type={task.workType}
          >
            <header className="driver-trip-print-header">
              <div>
                <p className="driver-trip-print-kicker">Jumping Jax Trip Sheet</p>
                <h1>{driverWorkTypeLongLabel(task.workType)}</h1>
                <p>{task.customerName}</p>
              </div>
              <div>
                <p>
                  <strong>Date:</strong> {formatDriverMobileDate(task.workDate ?? task.eventDate)}
                </p>
                <p>
                  <strong>Time / stop:</strong> {tripScheduleLabel(task)}
                </p>
                <p>
                  <strong>Status:</strong> {driverStatusLabel(task.routeStatus)}
                </p>
              </div>
            </header>

            <section>
              <h2>Customer</h2>
              <p>
                <strong>Name:</strong> {task.customerName}
              </p>
              <p>
                <strong>Phone:</strong> {task.customerPhone ?? "Not provided"}
              </p>
              <p>
                <strong>Address:</strong> {task.eventAddress ?? "Not provided"}
              </p>
              <p>
                <strong>Party start:</strong>{" "}
                {formatDriverMobileTime(task.eventStartTime)}
              </p>
            </section>

            <section>
              <h2>Rental equipment</h2>
              <ul>
                {equipment.map((item) => (
                  <li key={item.itemId}>
                    {item.rentalName}
                    {item.isPrimary ? " (this stop)" : ""}
                    {item.warning ? ` — ${item.warning}` : ""}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2>Operational notes</h2>
              <p>
                <strong>Setup location:</strong> {task.setupLocation ?? "—"}
              </p>
              <p>
                <strong>Surface:</strong> {task.setupSurface ?? "—"}
              </p>
              <p>
                <strong>Access:</strong> {task.setupAccess ?? "—"}
              </p>
              <p>
                <strong>Setup notes:</strong> {task.setupNotes ?? "—"}
              </p>
              <p>
                <strong>Route notes:</strong> {task.routeNotes ?? "—"}
              </p>
            </section>

            <section>
              <h2>Driver write-in</h2>
              <p className="driver-trip-print-line">
                <strong>Driver notes:</strong>
              </p>
              <p className="driver-trip-print-line">
                <strong>Condition:</strong>
              </p>
              <p className="driver-trip-print-line">
                <strong>Missing items:</strong>
              </p>
              <p className="driver-trip-print-line">
                <strong>Return confirmation:</strong>
              </p>
            </section>
          </article>
        );
      })}
    </section>
  );
}
