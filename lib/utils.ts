import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getStockStatus(available: number): {
  label: string;
  color: string;
  urgent: boolean;
} {
  if (available === 0) return { label: "Out of stock", color: "text-red-500", urgent: false };
  if (available <= 2) return { label: `Only ${available} left!`, color: "text-red-500", urgent: true };
  if (available <= 5) return { label: `${available} left`, color: "text-amber-500", urgent: true };
  return { label: `${available} in stock`, color: "text-emerald-500", urgent: false };
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

export function generateIdempotencyKey(): string {
  return `idk_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}
