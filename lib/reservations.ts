// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
import { prisma } from "./prisma";
import { ErrorCodes } from "./schemas";

const RESERVATION_TTL_MINUTES = 10;

interface CreateReservationInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  customerEmail?: string;
  customerName?: string;
  sessionId?: string;
  idempotencyKey?: string;
}

/**
 * Creates a reservation using SELECT FOR UPDATE to prevent race conditions.
 *
 * Two concurrent requests for the last unit will serialize at the DB lock.
 * Exactly one succeeds; the other sees insufficient stock and gets a 409.
 */
export async function createReservation(input: CreateReservationInput) {
  const { productId, warehouseId, quantity, customerEmail, customerName, sessionId, idempotencyKey } = input;

  return await prisma.$transaction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (tx: any) => {
      // SELECT FOR UPDATE: acquires exclusive row-level lock.
      // Concurrent transactions block here until this one commits/rolls back.
      const stocks: Array<{ id: string; total: number; reserved: number }> = await tx.$queryRaw`
        SELECT id, total, reserved
        FROM "Stock"
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      const stock = stocks[0];
      if (!stock) throw new AppError(ErrorCodes.STOCK_NOT_FOUND, "Stock record not found", 404);

      const available = stock.total - stock.reserved;
      if (available < quantity) {
        throw new AppError(
          ErrorCodes.INSUFFICIENT_STOCK,
          `Only ${available} unit(s) available, requested ${quantity}`,
          409
        );
      }

      await tx.stock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reserved: { increment: quantity } },
      });

      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

      const reservation = await tx.reservation.create({
        data: { productId, warehouseId, quantity, status: "PENDING", expiresAt, customerEmail, customerName, sessionId, idempotencyKey },
        include: {
          product: { select: { id: true, name: true, price: true, sku: true, imageUrl: true } },
          warehouse: { select: { id: true, name: true, location: true, code: true } },
        },
      });

      await tx.auditLog.create({
        data: { reservationId: reservation.id, action: "CREATED", metadata: { quantity, available, customerEmail } },
      });

      return reservation;
    },
    { timeout: 10000, isolationLevel: "ReadCommitted" }
  );
}

export async function confirmReservation(reservationId: string) {
  return await prisma.$transaction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (tx: any) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: {
          product: { select: { id: true, name: true, price: true, sku: true, imageUrl: true } },
          warehouse: { select: { id: true, name: true, location: true, code: true } },
        },
      });

      if (!reservation) throw new AppError(ErrorCodes.RESERVATION_NOT_FOUND, "Reservation not found", 404);

      if (reservation.status !== "PENDING") {
        if (reservation.status === "EXPIRED") throw new AppError(ErrorCodes.RESERVATION_EXPIRED, "Reservation has expired", 410);
        throw new AppError(ErrorCodes.RESERVATION_NOT_PENDING, `Reservation is already ${reservation.status.toLowerCase()}`, 409);
      }

      if (reservation.expiresAt < new Date()) {
        await tx.stock.update({
          where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } },
          data: { reserved: { decrement: reservation.quantity } },
        });
        await tx.reservation.update({ where: { id: reservationId }, data: { status: "EXPIRED", releasedAt: new Date() } });
        await tx.auditLog.create({ data: { reservationId, action: "EXPIRED_ON_CONFIRM", metadata: { expiredAt: reservation.expiresAt } } });
        throw new AppError(ErrorCodes.RESERVATION_EXPIRED, "Reservation expired before payment could complete", 410);
      }

      await tx.stock.update({
        where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } },
        data: { reserved: { decrement: reservation.quantity }, total: { decrement: reservation.quantity } },
      });

      const confirmed = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        include: {
          product: { select: { id: true, name: true, price: true, sku: true, imageUrl: true } },
          warehouse: { select: { id: true, name: true, location: true, code: true } },
        },
      });

      await tx.auditLog.create({ data: { reservationId, action: "CONFIRMED", metadata: { confirmedAt: new Date() } } });
      return confirmed;
    }
  );
}

export async function releaseReservation(reservationId: string) {
  return await prisma.$transaction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (tx: any) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: {
          product: { select: { id: true, name: true, price: true, sku: true, imageUrl: true } },
          warehouse: { select: { id: true, name: true, location: true, code: true } },
        },
      });

      if (!reservation) throw new AppError(ErrorCodes.RESERVATION_NOT_FOUND, "Reservation not found", 404);
      if (reservation.status !== "PENDING") return reservation; // idempotent

      await tx.stock.update({
        where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } },
        data: { reserved: { decrement: reservation.quantity } },
      });

      const released = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "RELEASED", releasedAt: new Date() },
        include: {
          product: { select: { id: true, name: true, price: true, sku: true, imageUrl: true } },
          warehouse: { select: { id: true, name: true, location: true, code: true } },
        },
      });

      await tx.auditLog.create({ data: { reservationId, action: "RELEASED", metadata: { releasedAt: new Date() } } });
      return released;
    }
  );
}

/**
 * Sweeps expired PENDING reservations and releases their stock.
 * Uses SKIP LOCKED so concurrent workers don't double-process.
 */
export async function sweepExpiredReservations(): Promise<number> {
  const expired: Array<{ id: string; productId: string; warehouseId: string; quantity: number }> = await prisma.$queryRaw`
    SELECT id, "productId", "warehouseId", quantity
    FROM "Reservation"
    WHERE status = 'PENDING'
      AND "expiresAt" < NOW()
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  `;

  if (expired.length === 0) return 0;

  let released = 0;
  for (const res of expired) {
    try {
      await prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (tx: any) => {
          await tx.stock.update({
            where: { productId_warehouseId: { productId: res.productId, warehouseId: res.warehouseId } },
            data: { reserved: { decrement: res.quantity } },
          });
          await tx.reservation.update({ where: { id: res.id }, data: { status: "EXPIRED", releasedAt: new Date() } });
          await tx.auditLog.create({ data: { reservationId: res.id, action: "EXPIRED_BY_CRON", metadata: { sweepedAt: new Date() } } });
        }
      );
      released++;
    } catch (err) {
      console.error(`Failed to expire reservation ${res.id}:`, err);
    }
  }
  return released;
}

export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode: number) {
    super(message);
    this.name = "AppError";
  }
}
