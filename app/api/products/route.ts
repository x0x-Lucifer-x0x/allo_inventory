import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api";
import { sweepExpiredReservations } from "@/lib/reservations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await sweepExpiredReservations();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const warehouseId = searchParams.get("warehouseId");

    const products = await prisma.product.findMany({
      where: category ? { category } : undefined,
      include: {
        stock: {
          where: warehouseId ? { warehouseId } : undefined,
          include: { warehouse: { select: { id: true, name: true, location: true, code: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productsWithAvailability = (products as any[]).map((product) => ({
      ...product,
      stock: product.stock.map((s: { total: number; reserved: number; [key: string]: unknown }) => ({
        ...s,
        available: Math.max(0, s.total - s.reserved),
      })),
      totalAvailable: product.stock.reduce(
        (sum: number, s: { total: number; reserved: number }) => sum + Math.max(0, s.total - s.reserved),
        0
      ),
    }));

    return apiSuccess(productsWithAvailability);
  } catch (err) {
    return handleApiError(err);
  }
}
