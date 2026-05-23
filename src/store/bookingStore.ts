import { create } from "zustand";

export interface RentalSelection {
  rentalId: string;
  rentalTitle: string;
  rentalImage: string;
}

export type RentalCartItem = {
  rental_item: string;
  rental_name: string;
};

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
  rentalCartItems: RentalCartItem[];
  setRental: (rental: RentalSelection) => void;
  addRentalToCart: (item: RentalCartItem) => void;
  removeRentalFromCart: (rental_item: string) => void;
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
  rentalCartItems: [],
};

export const useBookingStore = create<BookingState>()((set) => ({
  ...initialBookingState,
  setRental: (rental) =>
    set({
      rentalId: rental.rentalId,
      rentalTitle: rental.rentalTitle,
      rentalImage: rental.rentalImage,
    }),
  addRentalToCart: (item) =>
    set((state) => {
      if (
        state.rentalCartItems.some(
          (cartItem) => cartItem.rental_item === item.rental_item,
        )
      ) {
        return state;
      }
      return { rentalCartItems: [...state.rentalCartItems, item] };
    }),
  removeRentalFromCart: (rental_item) =>
    set((state) => ({
      rentalCartItems: state.rentalCartItems.filter(
        (cartItem) => cartItem.rental_item !== rental_item,
      ),
    })),
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
  clearBooking: () => set({ ...initialBookingState }),
}));
