import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const { sweepExpiredReservations } = await import("@/lib/reservations");
    const released = await sweepExpiredReservations();
    const duration = Date.now() - startTime;

    console.log(`[CRON] Swept ${released} expired reservations in ${duration}ms`);

    return NextResponse.json({
      success: true,
      released,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[CRON] Sweep failed:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}