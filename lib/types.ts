// Shared types that mirror Prisma schema (used when Prisma namespace not available pre-generate)

export type Warehouse = {
  id: string;
  name: string;
  location: string;
  code: string;
  createdAt: Date;
};

export type Stock = {
  id: string;
  productId: string;
  warehouseId: string;
  total: number;
  reserved: number;
  updatedAt: Date;
  warehouse: Warehouse;
};

export type StockWithAvailable = Stock & { available: number };

export type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sku: string;
  price: number;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  stock: StockWithAvailable[];
  totalAvailable: number;
};

export type AuditLog = {
  id: string;
  reservationId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type Reservation = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expiresAt: Date;
  customerEmail: string | null;
  customerName: string | null;
  sessionId: string | null;
  idempotencyKey: string | null;
  confirmedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    price: number;
    sku: string;
    imageUrl: string | null;
    description?: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
    code: string;
  };
  auditLogs?: AuditLog[];
};
