import mysql from 'mysql2/promise';
import { Redis } from 'ioredis';
import { config } from '../config.js';
// MySQL Connection Pool
export const dbPool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
});
// Redis Client with graceful error fallback
export const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});
redis.on('error', (err) => {
    // Silent log in dev / container warmup
    if (config.nodeEnv !== 'test') {
        console.warn(`[Redis] Cache warning: ${err.message}`);
    }
});
// Health check helper
export async function testDbConnection() {
    try {
        const connection = await dbPool.getConnection();
        await connection.ping();
        connection.release();
        return true;
    }
    catch (error) {
        console.error('[Database] Connection check failed:', error);
        return false;
    }
}
