# Allo — Inventory & Order Fulfillment Platform

A production-ready inventory reservation system for multi-warehouse retail and D2C brands.

## Local Setup

```bash
git clone <repo>
cd allo-inventory
npm install
cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, CRON_SECRET
npx prisma db push
npx prisma db seed
npm run dev
```

## Expiry Mechanism

Two-layer approach:
1. **Lazy cleanup**: Every product listing fetch runs sweepExpiredReservations() first
2. **Vercel Cron**: /api/cron/sweep runs every minute in production (vercel.json)

Both use SKIP LOCKED so concurrent workers don't double-process.

## Concurrency

SELECT FOR UPDATE acquires an exclusive row-level lock on the Stock row. Concurrent requests block at that line — exactly one proceeds, the other sees updated reserved count and gets 409.

## Idempotency

Pass Idempotency-Key header. Server caches {statusCode, response} in Redis for 24h. Replayed responses include X-Idempotency-Replayed: true header.

## Trade-offs

- SELECT FOR UPDATE over optimistic locking: simpler correctness, appropriate for inventory
- Lazy sweep + cron over Redis TTL events: less operational complexity
- No auth: would tie reservations to user sessions in production
- Polling every 10s on reservation page: SSE would be more efficient at scale
