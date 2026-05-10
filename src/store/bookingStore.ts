import { create } from "zustand";

export interface RentalSelection {
  rentalId: string;
  rentalTitle: string;
  rentalImage: string;
}

export interface CustomerInfo {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  eventAddress: string;
}

interface BookingDates {
  startDate: string;
  endDate: string;
}

type BookingStatus = "draft" | "pending" | "approved";

export interface BookingState extends RentalSelection, BookingDates, CustomerInfo {
  quantity: number;
  notes: string;
  status: BookingStatus;
  blockedDates: string[];
  availabilityChecked: boolean;
  paymentIntentId: string | null;
  checkoutStep: "rental" | "details" | "review" | "payment";
  setRental: (rental: RentalSelection) => void;
  setDates: (dates: BookingDates) => void;
  setQuantity: (quantity: number) => void;
  setCustomerInfo: (customerInfo: CustomerInfo) => void;
  setNotes: (notes: string) => void;
  clearBooking: () => void;
}

const initialBookingState = {
  rentalId: "",
  rentalTitle: "",
  rentalImage: "",
  startDate: "",
  endDate: "",
  quantity: 1,
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  eventAddress: "",
  notes: "",
  status: "draft" as BookingStatus,
  blockedDates: [],
  availabilityChecked: false,
  paymentIntentId: null,
  checkoutStep: "rental" as const,
};

export const useBookingStore = create<BookingState>((set) => ({
  ...initialBookingState,
  setRental: (rental) =>
    set({
      rentalId: rental.rentalId,
      rentalTitle: rental.rentalTitle,
      rentalImage: rental.rentalImage,
    }),
  setDates: (dates) =>
    set({
      startDate: dates.startDate,
      endDate: dates.endDate,
      availabilityChecked: false,
    }),
  setQuantity: (quantity) =>
    set({
      quantity: Math.max(1, quantity),
    }),
  setCustomerInfo: (customerInfo) =>
    set({
      customerName: customerInfo.customerName,
      customerPhone: customerInfo.customerPhone,
      customerEmail: customerInfo.customerEmail,
      eventAddress: customerInfo.eventAddress,
    }),
  setNotes: (notes) => set({ notes }),
  clearBooking: () => set(initialBookingState),
}));
