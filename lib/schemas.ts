import { z } from "zod";

// ─── Request schemas ──────────────────────────────────────────────────────────

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be positive")
    .max(100, "Quantity cannot exceed 100 units per order"),
  customerEmail: z.string().email("Invalid email").optional(),
  customerName: z.string().min(1).max(100).optional(),
  sessionId: z.string().optional(),
});

export const ConfirmReservationSchema = z.object({
  reservationId: z.string(),
});

// ─── Response types ───────────────────────────────────────────────────────────

export const ReservationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "RELEASED",
  "EXPIRED",
]);

export const ReservationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number(),
  status: ReservationStatusSchema,
  expiresAt: z.string(),
  customerEmail: z.string().nullable(),
  customerName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ─── API Error codes ──────────────────────────────────────────────────────────

export const ErrorCodes = {
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  RESERVATION_EXPIRED: "RESERVATION_EXPIRED",
  RESERVATION_NOT_FOUND: "RESERVATION_NOT_FOUND",
  RESERVATION_NOT_PENDING: "RESERVATION_NOT_PENDING",
  STOCK_NOT_FOUND: "STOCK_NOT_FOUND",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;
export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
