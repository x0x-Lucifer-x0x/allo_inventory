import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, price: true, sku: true, imageUrl: true, description: true } },
        warehouse: { select: { id: true, name: true, location: true, code: true } },
        auditLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!reservation) return apiError("Reservation not found", "RESERVATION_NOT_FOUND", 404);

    const timeLeftMs = Math.max(0, new Date(reservation.expiresAt).getTime() - Date.now());

    return apiSuccess({
      reservation,
      timeLeftSeconds: Math.floor(timeLeftMs / 1000),
      isExpired: reservation.status === "PENDING" && reservation.expiresAt < new Date(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
