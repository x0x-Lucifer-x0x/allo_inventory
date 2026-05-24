"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Warehouse,
  RefreshCw,
  DollarSign,
} from "lucide-react";
import { formatPrice, cn, getStockStatus } from "@/lib/utils";

type Metrics = {
  reservations: {
    total: number;
    pending: number;
    confirmed: number;
    released: number;
    expired: number;
    conversionRate: number;
  };
  inventory: {
    totalStock: number;
    totalReserved: number;
    totalAvailable: number;
    utilizationRate: number;
  };
  revenue: number;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    category: string | null;
    stock: Array<{
      available: number;
      total: number;
      reserved: number;
      warehouse: { name: string; code: string };
    }>;
  }>;
  recentReservations: Array<{
    id: string;
    quantity: number;
    status: string;
    createdAt: string | Date;
    product: { name: string; sku: string };
    warehouse: { name: string; code: string };
  }>;
};

export function DashboardClient({ metrics }: { metrics: Metrics }) {
  const [data, setData] = useState(metrics);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  async function refresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/metrics");
      const json = await res.json();
      if (json.success) {
        // Reload the full page to get fresh server data
        window.location.reload();
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusColors: Record<string, string> = {
    PENDING: "bg-indigo-100 text-indigo-700",
    CONFIRMED: "bg-emerald-100 text-emerald-700",
    RELEASED: "bg-gray-100 text-gray-600",
    EXPIRED: "bg-red-100 text-red-600",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
            Operations Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
          label="Revenue (Confirmed)"
          value={formatPrice(data.revenue)}
          sub={`${data.reservations.confirmed} orders`}
          color="emerald"
        />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
          label="Conversion Rate"
          value={`${data.reservations.conversionRate}%`}
          sub={`${data.reservations.total} total reservations`}
          color="indigo"
        />
        <MetricCard
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="Active Holds"
          value={data.reservations.pending.toString()}
          sub="Pending payment"
          color="amber"
        />
        <MetricCard
          icon={<Package className="w-5 h-5 text-blue-500" />}
          label="Available Units"
          value={data.inventory.totalAvailable.toString()}
          sub={`of ${data.inventory.totalStock} total`}
          color="blue"
        />
      </div>

      {/* Reservation breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Reservation Breakdown
          </h2>
          <div className="space-y-3">
            {[
              { label: "Confirmed", count: data.reservations.confirmed, icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, color: "emerald" },
              { label: "Pending", count: data.reservations.pending, icon: <Clock className="w-4 h-4 text-indigo-500" />, color: "indigo" },
              { label: "Released", count: data.reservations.released, icon: <XCircle className="w-4 h-4 text-gray-400" />, color: "gray" },
              { label: "Expired", count: data.reservations.expired, icon: <AlertTriangle className="w-4 h-4 text-red-400" />, color: "red" },
            ].map(({ label, count, icon, color }) => {
              const pct = data.reservations.total > 0
                ? Math.round((count / data.reservations.total) * 100)
                : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      {icon} {label}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{count} <span className="font-normal text-gray-400">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={cn("h-2 rounded-full", {
                        "bg-emerald-500": color === "emerald",
                        "bg-indigo-500": color === "indigo",
                        "bg-gray-300": color === "gray",
                        "bg-red-400": color === "red",
                      })}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inventory utilization */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-indigo-500" />
            Inventory Utilization
          </h2>
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 120 120" className="w-36 h-36 -rotate-90">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="48"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="12"
                  strokeDasharray={`${(data.inventory.utilizationRate / 100) * 301.6} 301.6`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">{data.inventory.utilizationRate}%</span>
                <span className="text-xs text-gray-400">reserved</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total", value: data.inventory.totalStock, color: "text-gray-800" },
              { label: "Reserved", value: data.inventory.totalReserved, color: "text-indigo-600" },
              { label: "Available", value: data.inventory.totalAvailable, color: "text-emerald-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-gray-50 rounded-xl p-3">
                <p className={cn("text-xl font-bold", color)}>{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent reservations */}
      <div className="bg-white rounded-2xl border border-gray-200 mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Reservations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-400 bg-gray-50">
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Warehouse</th>
                <th className="px-6 py-3">Qty</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.recentReservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.product.name}</p>
                      <p className="text-xs font-mono text-gray-400">{r.product.sku}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-gray-700">{r.warehouse.name}</span>
                    <span className="ml-1 text-xs text-gray-400">({r.warehouse.code})</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{r.quantity}</td>
                  <td className="px-6 py-3">
                    <span className={cn("text-xs font-medium px-2 py-1 rounded-full", statusColors[r.status])}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.recentReservations.length === 0 && (
            <div className="text-center py-12 text-gray-400">No reservations yet</div>
          )}
        </div>
      </div>

      {/* Product stock table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Stock by Product & Warehouse</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-400 bg-gray-50">
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Warehouse</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Reserved</th>
                <th className="px-6 py-3">Available</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.products.flatMap((p) =>
                p.stock.map((s) => {
                  const ss = getStockStatus(s.available);
                  return (
                    <tr key={`${p.id}-${s.warehouse.code}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs font-mono text-gray-400">{p.sku}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm text-gray-700">{s.warehouse.name}</span>
                        <span className="ml-1 text-xs text-gray-400">({s.warehouse.code})</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">{s.total}</td>
                      <td className="px-6 py-3 text-sm text-indigo-600 font-medium">{s.reserved}</td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900">{s.available}</td>
                      <td className="px-6 py-3">
                        <span className={cn("text-xs font-medium", ss.color)}>
                          {ss.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
