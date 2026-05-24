"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  MapPin,
  AlertTriangle,
  ShoppingBag,
  ArrowLeft,
  RefreshCw,
  Activity,
  Shield,
} from "lucide-react";
import { formatPrice, formatDuration, cn } from "@/lib/utils";
import Link from "next/link";
import { generateIdempotencyKey } from "@/lib/utils";

type AuditLog = {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | Date;
};

type ReservationData = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expiresAt: string | Date;
  customerEmail: string | null;
  customerName: string | null;
  createdAt: string | Date;
  confirmedAt: string | Date | null;
  releasedAt: string | Date | null;
  product: {
    id: string;
    name: string;
    price: number;
    sku: string;
    imageUrl: string | null;
    description: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
    code: string;
  };
  auditLogs: AuditLog[];
};

interface ReservationClientProps {
  initialReservation: ReservationData;
}

export function ReservationClient({ initialReservation }: ReservationClientProps) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [timeLeftMs, setTimeLeftMs] = useState(
    Math.max(0, new Date(initialReservation.expiresAt).getTime() - Date.now())
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [hasExpiredLocally, setHasExpiredLocally] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (reservation.status !== "PENDING") return;

    const interval = setInterval(() => {
      const left = new Date(reservation.expiresAt).getTime() - Date.now();
      if (left <= 0) {
        setTimeLeftMs(0);
        setHasExpiredLocally(true);
        clearInterval(interval);
      } else {
        setTimeLeftMs(left);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [reservation.expiresAt, reservation.status]);

  // Poll for state updates every 10s while PENDING (handles server-side expiry)
  useEffect(() => {
    if (reservation.status !== "PENDING") return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/reservations/${reservation.id}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.data?.reservation.status !== "PENDING") {
          setReservation(json.data.reservation);
          clearInterval(poll);
        }
      } catch {
        // Non-fatal polling failure
      }
    }, 10000);

    return () => clearInterval(poll);
  }, [reservation.id, reservation.status]);

  const handleConfirm = useCallback(async () => {
    if (hasExpiredLocally) {
      toast.error("Reservation has expired", {
        description: "The 10-minute window has passed. Please start a new reservation.",
      });
      return;
    }

    setIsConfirming(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const json = await res.json();

      if (res.status === 410) {
        toast.error("Reservation expired", {
          description: "The time window expired before payment could complete.",
        });
        setHasExpiredLocally(true);
        return;
      }

      if (!res.ok) {
        toast.error("Confirmation failed", {
          description: json.error?.message ?? "Please try again.",
        });
        return;
      }

      setReservation(json.data.reservation);
      toast.success("Order confirmed! 🎉", {
        description: `${reservation.product.name} is on its way from ${reservation.warehouse.name}.`,
      });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  }, [hasExpiredLocally, reservation]);

  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error("Failed to cancel", {
          description: json.error?.message ?? "Please try again.",
        });
        return;
      }

      setReservation(json.data.reservation);
      toast.info("Reservation cancelled", {
        description: "Stock has been returned to inventory.",
      });

      setTimeout(() => router.push("/"), 2000);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }, [reservation.id, router]);

  const totalPrice = reservation.product.price * reservation.quantity;
  const isExpired =
    hasExpiredLocally ||
    reservation.status === "EXPIRED" ||
    (reservation.status === "PENDING" &&
      new Date(reservation.expiresAt) < new Date());

  const urgencyPercent = reservation.status === "PENDING"
    ? Math.round((timeLeftMs / (10 * 60 * 1000)) * 100)
    : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to products
      </Link>

      {/* Status banner */}
      <StatusBanner status={isExpired ? "EXPIRED" : reservation.status} />

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-4">
        {/* Product header */}
        <div className="flex gap-4 p-6 border-b border-gray-100">
          {reservation.product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reservation.product.imageUrl}
              alt={reservation.product.name}
              className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-mono">{reservation.product.sku}</p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">
              {reservation.product.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {reservation.product.description}
            </p>
          </div>
        </div>

        {/* Reservation details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DetailItem
              icon={<Package className="w-4 h-4" />}
              label="Quantity"
              value={`${reservation.quantity} unit${reservation.quantity > 1 ? "s" : ""}`}
            />
            <DetailItem
              icon={<ShoppingBag className="w-4 h-4" />}
              label="Total"
              value={formatPrice(totalPrice)}
              highlight
            />
            <DetailItem
              icon={<MapPin className="w-4 h-4" />}
              label="Warehouse"
              value={`${reservation.warehouse.name} (${reservation.warehouse.code})`}
            />
            <DetailItem
              icon={<MapPin className="w-4 h-4" />}
              label="Location"
              value={reservation.warehouse.location}
            />
          </div>

          {/* Reservation ID */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Reservation ID</p>
            <p className="font-mono text-sm text-gray-700 break-all">{reservation.id}</p>
          </div>

          {/* Countdown timer — only show when PENDING */}
          {reservation.status === "PENDING" && !isExpired && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Clock className="w-4 h-4" />
                  Time remaining
                </div>
                <span
                  className={cn(
                    "text-lg font-bold font-mono tabular-nums",
                    timeLeftMs < 60000
                      ? "text-red-500"
                      : timeLeftMs < 3 * 60000
                      ? "text-amber-500"
                      : "text-gray-900"
                  )}
                >
                  {formatDuration(timeLeftMs)}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-500",
                    urgencyPercent > 50
                      ? "bg-emerald-500"
                      : urgencyPercent > 20
                      ? "bg-amber-500"
                      : "bg-red-500"
                  )}
                  style={{ width: `${urgencyPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Expired warning */}
          {isExpired && reservation.status === "PENDING" && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  Reservation Expired
                </p>
                <p className="text-sm text-red-600 mt-0.5">
                  The 10-minute window has passed. The stock has been released back to
                  inventory.
                </p>
              </div>
            </div>
          )}

          {/* Idempotency notice */}
          {reservation.status === "PENDING" && !isExpired && (
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              Safe to retry — confirm and cancel buttons are idempotent.
            </div>
          )}
        </div>

        {/* Actions */}
        {reservation.status === "PENDING" && (
          <div className="p-6 pt-0 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={isConfirming || isCancelling || isExpired}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all",
                isExpired
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : isConfirming
                  ? "bg-emerald-400 text-white cursor-wait"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-sm"
              )}
            >
              {isConfirming ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Purchase
                </>
              )}
            </button>

            <button
              onClick={handleCancel}
              disabled={isConfirming || isCancelling}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-sm border transition-all",
                isCancelling
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-wait"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]"
              )}
            >
              {isCancelling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Cancel
                </>
              )}
            </button>
          </div>
        )}

        {/* Post-action nav */}
        {(reservation.status === "CONFIRMED" ||
          reservation.status === "RELEASED" ||
          reservation.status === "EXPIRED") && (
          <div className="p-6 pt-0">
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
            >
              <Package className="w-4 h-4" />
              Back to Catalog
            </Link>
          </div>
        )}
      </div>

      {/* Audit log */}
      {(reservation.auditLogs ?? []).length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Activity className="w-4 h-4" />
            Activity Log
          </div>
          <div className="space-y-2">
            {(reservation.auditLogs ?? []).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-300 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 font-mono">
                    {log.action}
                  </span>
                  <span className="text-xs text-gray-400 ml-3">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBanner({
  status,
}: {
  status: "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";
}) {
  const configs = {
    PENDING: {
      icon: <Clock className="w-5 h-5" />,
      text: "Reservation Active",
      sub: "Complete your purchase before the timer expires",
      className: "bg-indigo-50 border-indigo-200 text-indigo-700",
    },
    CONFIRMED: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      text: "Purchase Confirmed!",
      sub: "Your order has been placed successfully",
      className: "bg-emerald-50 border-emerald-200 text-emerald-700",
    },
    RELEASED: {
      icon: <XCircle className="w-5 h-5" />,
      text: "Reservation Cancelled",
      sub: "Stock has been returned to inventory",
      className: "bg-gray-50 border-gray-200 text-gray-600",
    },
    EXPIRED: {
      icon: <AlertTriangle className="w-5 h-5" />,
      text: "Reservation Expired",
      sub: "The 10-minute window passed without payment",
      className: "bg-red-50 border-red-200 text-red-700",
    },
  };

  const config = configs[status];

  return (
    <div
      className={cn(
        "flex items-center gap-3 border rounded-xl px-4 py-3",
        config.className
      )}
    >
      {config.icon}
      <div>
        <p className="font-semibold text-sm">{config.text}</p>
        <p className="text-xs opacity-75">{config.sub}</p>
      </div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "font-semibold text-sm",
          highlight ? "text-indigo-600 text-base" : "text-gray-800"
        )}
      >
        {value}
      </p>
    </div>
  );
}
