import path from 'path';
import dotenv from 'dotenv';
import IORedis from 'ioredis';

// Ensure .env is loaded if this file is imported first
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === '') {
    throw new Error('[Worker] Missing required environment variable: REDIS_URL. Please define it in your .env file.');
  }
  return url.trim();
}

let sharedConnection: IORedis | null = null;

/**
 * Checks if Redis server is reachable with a quick ping.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const redisUrl = getRedisUrl();
  const testConn = new IORedis(redisUrl, {
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Do not retry on check
    lazyConnect: true
  });

  try {
    await testConn.connect();
    const pong = await testConn.ping();
    await testConn.quit();
    return pong === 'PONG';
  } catch {
    testConn.disconnect();
    return false;
  }
}

/**
 * Returns a dedicated connection for BullMQ Worker instances.
 * BullMQ requires maxRetriesPerRequest: null.
 */
export function createWorkerConnection(): IORedis {
  const redisUrl = getRedisUrl();
  const conn = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      // Throttle reconnection attempts to prevent console flooding
      if (times > 5) return 10000;
      return Math.min(times * 1500, 5000);
    }
  });

  conn.on('error', (err: any) => {
    // Only log if not a standard ECONNREFUSED spam
    if (err.code !== 'ECONNREFUSED') {
      console.warn('⚠️  Redis worker connection error:', err.message);
    }
  });

  return conn;
}

export function getSharedConnection(): IORedis {
  if (!sharedConnection) {
    const redisUrl = getRedisUrl();
    sharedConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 5) return 10000;
        return Math.min(times * 1500, 5000);
      }
    });

    sharedConnection.on('error', (err: any) => {
      if (err.code !== 'ECONNREFUSED') {
        console.warn('⚠️  Redis shared connection error:', err.message);
      }
    });
  }

  return sharedConnection;
}
