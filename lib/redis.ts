import { Redis } from "@upstash/redis";

// Singleton Redis client for Upstash
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Return a mock Redis for build/environments without Redis
    return {
      get: async () => null,
      set: async () => "OK",
      del: async () => 1,
      expire: async () => 1,
    } as unknown as Redis;
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// Idempotency helpers
export async function getIdempotencyResult(key: string) {
  try {
    const result = await redis.get<{ statusCode: number; response: unknown }>(
      `idempotency:${key}`
    );
    return result;
  } catch {
    return null;
  }
}

export async function setIdempotencyResult(
  key: string,
  statusCode: number,
  response: unknown,
  ttlSeconds = 86400 // 24 hours
) {
  try {
    await redis.set(
      `idempotency:${key}`,
      { statusCode, response },
      { ex: ttlSeconds }
    );
  } catch {
    // Non-fatal: idempotency is best-effort
    console.warn("Failed to save idempotency result to Redis");
  }
}

// Rate limiting key helpers
export function reservationRateLimitKey(ip: string) {
  return `rate:reserve:${ip}`;
}

export async function checkRateLimit(key: string, limit: number, windowSecs: number) {
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSecs);
    }
    return { allowed: current <= limit, current, limit };
  } catch {
    return { allowed: true, current: 0, limit }; // Fail open
  }
}
