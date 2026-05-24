import { NextRequest } from "next/server";
import { confirmReservation, AppError } from "@/lib/reservations";
import { apiError, handleApiError } from "@/lib/api";
import { getIdempotencyResult, setIdempotencyResult } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idempotencyKey = request.headers.get("Idempotency-Key");

    if (idempotencyKey) {
      const cached = await getIdempotencyResult(`confirm:${idempotencyKey}`);
      if (cached) {
        return new Response(JSON.stringify(cached.response), {
          status: cached.statusCode,
          headers: { "Content-Type": "application/json", "X-Idempotency-Replayed": "true" },
        });
      }
    }

    const reservation = await confirmReservation(id);

    const responseBody = {
      success: true,
      data: { reservation, message: "Payment confirmed. Your order is placed!" },
    };

    if (idempotencyKey) {
      await setIdempotencyResult(`confirm:${idempotencyKey}`, 200, responseBody);
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof AppError) return apiError(err.message, err.code, err.statusCode);
    return handleApiError(err);
  }
}
