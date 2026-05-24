import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

async function getMetrics() {
  const [
    totalReservations, pendingCount, confirmedCount, releasedCount, expiredCount,
    products, stockSummary, recentReservations,
  ] = await Promise.all([
    prisma.reservation.count(),
    prisma.reservation.count({ where: { status: "PENDING" } }),
    prisma.reservation.count({ where: { status: "CONFIRMED" } }),
    prisma.reservation.count({ where: { status: "RELEASED" } }),
    prisma.reservation.count({ where: { status: "EXPIRED" } }),
    prisma.product.findMany({ include: { stock: { include: { warehouse: true } } } }),
    prisma.stock.aggregate({ _sum: { total: true, reserved: true } }),
    prisma.reservation.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true, code: true } },
      },
    }),
  ]);

  const revenueData = await prisma.reservation.findMany({
    where: { status: "CONFIRMED" },
    include: { product: { select: { price: true } } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalRevenue = (revenueData as any[]).reduce(
    (sum: number, r: { quantity: number; product: { price: number } }) => sum + r.product.price * r.quantity,
    0
  );

  const totalStock = stockSummary._sum.total ?? 0;
  const totalReserved = stockSummary._sum.reserved ?? 0;

  return {
    reservations: {
      total: totalReservations,
      pending: pendingCount,
      confirmed: confirmedCount,
      released: releasedCount,
      expired: expiredCount,
      conversionRate: totalReservations > 0 ? Math.round((confirmedCount / totalReservations) * 100) : 0,
    },
    inventory: {
      totalStock, totalReserved,
      totalAvailable: totalStock - totalReserved,
      utilizationRate: totalStock > 0 ? Math.round((totalReserved / totalStock) * 100) : 0,
    },
    revenue: totalRevenue,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: (products as any[]).map((p) => ({
      ...p,
      stock: p.stock.map((s: { total: number; reserved: number; [key: string]: unknown }) => ({
        ...s,
        available: Math.max(0, s.total - s.reserved),
      })),
    })),
    recentReservations,
  };
}

export default async function DashboardPage() {
  const metrics = await getMetrics();
  return <DashboardClient metrics={metrics} />;
}
