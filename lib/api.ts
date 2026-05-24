import { NextResponse } from "next/server";
import { AppError } from "./reservations";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, code: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: { message, code, details: details ?? null },
    },
    { status }
  );
}

export function handleApiError(err: unknown) {
  if (err instanceof AppError) {
    return apiError(err.message, err.code, err.statusCode);
  }

  console.error("Unhandled API error:", err);
  return apiError("An unexpected error occurred", "INTERNAL_ERROR", 500);
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
