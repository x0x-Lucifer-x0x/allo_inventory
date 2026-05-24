"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package, Warehouse, ShoppingCart, AlertCircle, RefreshCw } from "lucide-react";
import { formatPrice, getStockStatus, generateIdempotencyKey } from "@/lib/utils";
import { cn } from "@/lib/utils";

type StockEntry = {
  id: string;
  productId: string;
  warehouseId: string;
  total: number;
  reserved: number;
  available: number;
  warehouse: {
    id: string;
    name: string;
    location: string;
    code: string;
  };
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sku: string;
  price: number;
  category: string | null;
  stock: StockEntry[];
  totalAvailable: number;
};

interface ProductGridProps {
  products: Product[];
  categories: string[];
}

export function ProductGrid({ products, categories }: ProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const router = useRouter();

  const filtered =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div>
      {/* Category filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
            selectedCategory === "all"
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"
          )}
        >
          All ({products.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              selectedCategory === cat
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"
            )}
          >
            {cat} ({products.filter((p) => p.category === cat).length})
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isLoading={loadingProductId === product.id}
            onLoadingChange={(loading) =>
              setLoadingProductId(loading ? product.id : null)
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No products found</p>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  isLoading,
  onLoadingChange,
}: {
  product: Product;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}) {
  const router = useRouter();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    product.stock[0]?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);

  const selectedStock = product.stock.find(
    (s) => s.warehouseId === selectedWarehouseId
  );
  const available = selectedStock?.available ?? 0;
  const stockStatus = getStockStatus(available);

  async function handleReserve() {
    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse");
      return;
    }
    if (available < quantity) {
      toast.error(`Only ${available} unit(s) available`);
      return;
    }

    onLoadingChange(true);

    try {
      const idempotencyKey = generateIdempotencyKey();

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouseId,
          quantity,
        }),
      });

      const json = await res.json();

      if (res.status === 409) {
        toast.error("Not enough stock available", {
          description: json.error?.message ?? "Another customer may have just reserved this item.",
        });
        router.refresh();
        return;
      }

      if (res.status === 429) {
        toast.error("Too many requests", {
          description: "Please wait a moment before trying again.",
        });
        return;
      }

      if (!res.ok) {
        toast.error("Failed to create reservation", {
          description: json.error?.message ?? "Please try again.",
        });
        return;
      }

      toast.success("Reserved! Complete your purchase within 10 minutes.");
      router.push(`/reservation/${json.data.reservation.id}`);
    } catch (err) {
      toast.error("Network error", {
        description: "Check your connection and try again.",
      });
    } finally {
      onLoadingChange(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Product image */}
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="w-16 h-16 text-gray-300" />
          </div>
        )}

        {/* Category badge */}
        {product.category && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-600 px-2 py-1 rounded-full border border-gray-200">
            {product.category}
          </span>
        )}

        {/* Out of stock overlay */}
        {product.totalAvailable === 0 && (
          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-sm font-semibold px-3 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-3">
          <p className="text-xs text-gray-400 font-mono mb-1">{product.sku}</p>
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-auto space-y-4">
          {/* Price */}
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {formatPrice(product.price)}
            </span>
            <span className={cn("text-sm font-medium", stockStatus.color)}>
              {stockStatus.urgent && (
                <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              )}
              {stockStatus.label}
            </span>
          </div>

          {/* Warehouse selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
              <Warehouse className="w-3.5 h-3.5" />
              Fulfill from warehouse
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={product.totalAvailable === 0}
            >
              {product.stock.map((s) => (
                <option key={s.warehouseId} value={s.warehouseId}>
                  {s.warehouse.name} — {s.available} available
                </option>
              ))}
            </select>
          </div>

          {/* Quantity selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="w-8 text-center font-medium text-gray-900">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(available, quantity + 1))}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                disabled={quantity >= available}
              >
                +
              </button>
            </div>
          </div>

          {/* Reserve button */}
          <button
            onClick={handleReserve}
            disabled={available === 0 || isLoading}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all",
              available === 0
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : isLoading
                ? "bg-indigo-400 text-white cursor-wait"
                : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-sm hover:shadow"
            )}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Reserving...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                {available === 0 ? "Unavailable" : "Reserve Now"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
