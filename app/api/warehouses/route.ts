import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        _count: {
          select: { stock: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return apiSuccess(warehouses);
  } catch (err) {
    return handleApiError(err);
  }
}
