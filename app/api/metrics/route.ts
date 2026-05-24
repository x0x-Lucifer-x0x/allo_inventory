import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const [
      totalReservations, pendingReservations, confirmedReservations,
      releasedReservations, expiredReservations, totalProducts, totalWarehouses, stockSummary,
    ] = await Promise.all([
      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: "PENDING" } }),
      prisma.reservation.count({ where: { status: "CONFIRMED" } }),
      prisma.reservation.count({ where: { status: "RELEASED" } }),
      prisma.reservation.count({ where: { status: "EXPIRED" } }),
      prisma.product.count(),
      prisma.warehouse.count(),
      prisma.stock.aggregate({ _sum: { total: true, reserved: true } }),
    ]);

    const totalStock = stockSummary._sum.total ?? 0;
    const totalReserved = stockSummary._sum.reserved ?? 0;
    const totalAvailable = totalStock - totalReserved;

    const revenueData = await prisma.reservation.findMany({
      where: { status: "CONFIRMED" },
      include: { product: { select: { price: true } } },
    });

    const totalRevenue = revenueData.reduce(
      (sum: number, r: { quantity: number; product: { price: number } }) =>
        sum + r.product.price * r.quantity,
      0
    );

    return apiSuccess({
      reservations: {
        total: totalReservations,
        pending: pendingReservations,
        confirmed: confirmedReservations,
        released: releasedReservations,
        expired: expiredReservations,
        conversionRate:
          totalReservations > 0 ? Math.round((confirmedReservations / totalReservations) * 100) : 0,
      },
      inventory: {
        totalProducts, totalWarehouses, totalStock, totalReserved, totalAvailable,
        utilizationRate: totalStock > 0 ? Math.round((totalReserved / totalStock) * 100) : 0,
      },
      revenue: {
        total: totalRevenue,
        formatted: `₹${(totalRevenue / 100).toLocaleString("en-IN")}`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
