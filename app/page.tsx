import { prisma } from "@/lib/prisma";
import { sweepExpiredReservations } from "@/lib/reservations";
import { ProductGrid } from "@/components/ProductGrid";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProducts(): Promise<Product[]> {
  await sweepExpiredReservations();

  const raw = await prisma.product.findMany({
    include: {
      stock: { include: { warehouse: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (raw as any[]).map((product) => ({
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
}

export default async function HomePage() {
  const products = await getProducts();
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const p of products) {
    if (p.category && !seen.has(p.category)) {
      seen.add(p.category);
      categories.push(p.category);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Product Catalog</h1>
        <p className="mt-2 text-gray-500">
          Real-time stock across all warehouses. Reservations held for 10 minutes.
        </p>
      </div>

      <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-indigo-600 text-xs font-bold">i</span>
        </div>
        <div className="text-sm text-indigo-700">
          <strong>How reservations work:</strong> When you click Reserve, we hold the unit for 10 minutes
          while you complete checkout. If two people try to reserve the last unit simultaneously, exactly
          one succeeds — no double-selling.
        </div>
      </div>

      <ProductGrid products={products} categories={categories} />
    </div>
  );
}
