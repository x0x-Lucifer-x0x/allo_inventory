import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReservationClient } from "@/components/ReservationClient";

export const dynamic = "force-dynamic";

async function getReservation(id: string) {
  return prisma.reservation.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, price: true, sku: true, imageUrl: true, description: true } },
      warehouse: { select: { id: true, name: true, location: true, code: true } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
}

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reservation = await getReservation(id);

  if (!reservation) notFound();

  return <ReservationClient initialReservation={reservation} />;
}
