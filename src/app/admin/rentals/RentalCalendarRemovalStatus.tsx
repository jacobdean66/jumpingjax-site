import type { RentalRemovalState } from "@/lib/bookings/rental-calendar-removal";
import { RentalCancellationButton } from "./RentalCancellationButton";

type Props = {
  status: RentalRemovalState;
  endpoint: string;
  customerName: string;
  eventDate: string;
  spanDays: number;
  itemNames: string[];
  currentStatus: string;
};

export function RentalCalendarRemovalStatus({ status, ...props }: Props) {
  return <div className="flex max-w-80 flex-col items-start gap-2">
    <p role="status" className={`text-xs font-bold ${status === "removed" ? "text-emerald-700" : "text-amber-800"}`}>
      {status === "removed" ? "Calendar events removed."
        : status === "access_required" ? "Restore Google Calendar access, then retry removal."
        : status === "attention_required" ? "Calendar removal needs attention. Check the connection or retry."
        : status === "pending" ? "Calendar removal pending. Automatic retries are scheduled."
        : "Calendar removal status could not be checked."}
    </p>
    {status !== "removed" ? <RentalCancellationButton {...props} retryCalendarOnly /> : null}
  </div>;
}
