import { NextRequest } from "next/server";
import { CreateReservationSchema } from "@/lib/schemas";
import { createReservation, AppError } from "@/lib/reservations";
import {
  apiSuccess,
  apiError,
  handleApiError,
  getClientIp,
} from "@/lib/api";
import {
  getIdempotencyResult,
  setIdempotencyResult,
  checkRateLimit,
} from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const idempotencyKey = request.headers.get("Idempotency-Key");

    // ── Rate limiting: max 10 reservations per IP per minute ──
    const rateLimit = await checkRateLimit(`rate:reserve:${ip}`, 10, 60);
    if (!rateLimit.allowed) {
      return apiError(
        "Too many reservation attempts. Please wait a moment.",
        "RATE_LIMIT_EXCEEDED",
        429
      );
    }

    // ── Idempotency: return cached response if key was seen before ──
    if (idempotencyKey) {
      const cached = await getIdempotencyResult(`reserve:${idempotencyKey}`);
      if (cached) {
        return new Response(JSON.stringify(cached.response), {
          status: cached.statusCode,
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Replayed": "true",
          },
        });
      }
    }

    // ── Validate request body ──
    const body = await request.json().catch(() => ({}));
    const parsed = CreateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Invalid request data",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten()
      );
    }

    // ── Create reservation (atomic, race-condition-safe) ──
    const reservation = await createReservation({
      ...parsed.data,
      idempotencyKey: idempotencyKey ?? undefined,
    });

    const responseBody = {
      success: true,
      data: {
        reservation,
        expiresIn: Math.floor(
          (new Date(reservation.expiresAt).getTime() - Date.now()) / 1000
        ),
      },
    };

    // Cache successful response for idempotency
    if (idempotencyKey) {
      await setIdempotencyResult(`reserve:${idempotencyKey}`, 201, responseBody);
    }

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof AppError) {
      const errorBody = {
        success: false,
        error: { message: err.message, code: err.code, details: null },
      };

      // Cache 409 for idempotency too (to prevent double-charging on retry)
      const idempotencyKey = request.headers.get("Idempotency-Key");
      if (idempotencyKey && err.statusCode === 409) {
        await setIdempotencyResult(
          `reserve:${idempotencyKey}`,
          err.statusCode,
          errorBody
        );
      }

      return apiError(err.message, err.code, err.statusCode);
    }

    return handleApiError(err);
  }
}
