import { NextRequest } from "next/server";
import { releaseReservation, AppError } from "@/lib/reservations";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reservation = await releaseReservation(id);

    return apiSuccess({ reservation, message: "Reservation cancelled. Stock has been returned." });
  } catch (err) {
    if (err instanceof AppError) return apiError(err.message, err.code, err.statusCode);
    return handleApiError(err);
  }
}
