import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.auditLog.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  const warehouses = await Promise.all([
    prisma.warehouse.create({ data: { name: "Mumbai Central", location: "Mumbai, Maharashtra", code: "MUM-01" } }),
    prisma.warehouse.create({ data: { name: "Delhi North", location: "Delhi, NCR", code: "DEL-01" } }),
    prisma.warehouse.create({ data: { name: "Bangalore Tech Park", location: "Bangalore, Karnataka", code: "BLR-01" } }),
  ]);

  const products = await Promise.all([
    prisma.product.create({ data: { name: "AirPods Pro (3rd Gen)", description: "Active Noise Cancellation, Adaptive Transparency", sku: "APP-3G-WHT", price: 2499900, category: "Audio", imageUrl: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400" } }),
    prisma.product.create({ data: { name: "Sony WH-1000XM5", description: "Industry-leading noise canceling with eight microphones", sku: "SNY-WH1000XM5-BLK", price: 2999900, category: "Audio", imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400" } }),
    prisma.product.create({ data: { name: 'MacBook Air M3 13"', description: "Supercharged by M3 chip. Up to 18 hours battery life.", sku: "MBA-M3-13-SLV", price: 114900000, category: "Laptops", imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400" } }),
    prisma.product.create({ data: { name: "Samsung Galaxy S24 Ultra", description: "200MP camera, S Pen included, Galaxy AI features", sku: "SAM-S24U-BLK", price: 129999000, category: "Smartphones", imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400" } }),
    prisma.product.create({ data: { name: "Mechanical Keyboard (TKL)", description: "Cherry MX Red switches, RGB backlit, aluminum frame", sku: "KBD-TKL-RED", price: 599900, category: "Peripherals", imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400" } }),
    prisma.product.create({ data: { name: "Logitech MX Master 3S", description: "Advanced wireless mouse, 8K DPI sensor, MagSpeed scrolling", sku: "LOG-MXM3S-GRY", price: 999900, category: "Peripherals", imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400" } }),
  ]);

  await prisma.stock.createMany({
    data: [
      { productId: products[0].id, warehouseId: warehouses[0].id, total: 15, reserved: 0 },
      { productId: products[0].id, warehouseId: warehouses[1].id, total: 8,  reserved: 0 },
      { productId: products[0].id, warehouseId: warehouses[2].id, total: 3,  reserved: 0 },
      { productId: products[1].id, warehouseId: warehouses[0].id, total: 10, reserved: 0 },
      { productId: products[1].id, warehouseId: warehouses[1].id, total: 5,  reserved: 0 },
      { productId: products[1].id, warehouseId: warehouses[2].id, total: 1,  reserved: 0 },
      { productId: products[2].id, warehouseId: warehouses[0].id, total: 4,  reserved: 0 },
      { productId: products[2].id, warehouseId: warehouses[1].id, total: 2,  reserved: 0 },
      { productId: products[2].id, warehouseId: warehouses[2].id, total: 6,  reserved: 0 },
      { productId: products[3].id, warehouseId: warehouses[0].id, total: 20, reserved: 0 },
      { productId: products[3].id, warehouseId: warehouses[1].id, total: 12, reserved: 0 },
      { productId: products[3].id, warehouseId: warehouses[2].id, total: 7,  reserved: 0 },
      { productId: products[4].id, warehouseId: warehouses[0].id, total: 25, reserved: 0 },
      { productId: products[4].id, warehouseId: warehouses[1].id, total: 18, reserved: 0 },
      { productId: products[4].id, warehouseId: warehouses[2].id, total: 2,  reserved: 0 },
      { productId: products[5].id, warehouseId: warehouses[0].id, total: 30, reserved: 0 },
      { productId: products[5].id, warehouseId: warehouses[1].id, total: 22, reserved: 0 },
      { productId: products[5].id, warehouseId: warehouses[2].id, total: 15, reserved: 0 },
    ],
  });

  console.log(`✅ Created ${warehouses.length} warehouses, ${products.length} products, 18 stock entries`);
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });