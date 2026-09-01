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
// Health check & auto-migration helper
export async function testDbConnection() {
    try {
        const connection = await dbPool.getConnection();
        await connection.ping();
        // Auto-create required licensing tables if not yet created
        await connection.query(`
      CREATE TABLE IF NOT EXISTS \`customers\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) DEFAULT NULL,
        \`stripe_customer_id\` VARCHAR(128) UNIQUE DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_customers_email\` (\`email\`),
        INDEX \`idx_customers_stripe\` (\`stripe_customer_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS \`plans\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`name\` VARCHAR(128) NOT NULL,
        \`tier\` ENUM('monthly', 'annual', 'lifetime') NOT NULL,
        \`price_cents\` INT UNSIGNED NOT NULL,
        \`currency\` VARCHAR(3) NOT NULL DEFAULT 'usd',
        \`billing_interval\` VARCHAR(32) NOT NULL DEFAULT 'month',
        \`stripe_price_id\` VARCHAR(128) DEFAULT NULL,
        \`max_devices\` INT UNSIGNED NOT NULL DEFAULT 3,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        await connection.query(`
      INSERT INTO \`plans\` (\`id\`, \`name\`, \`tier\`, \`price_cents\`, \`currency\`, \`billing_interval\`, \`stripe_price_id\`, \`max_devices\`)
      VALUES 
        ('plan_monthly', 'Ravn Pro Monthly', 'monthly', 499, 'usd', 'month', 'price_monthly_sample', 3),
        ('plan_annual', 'Ravn Pro Annual', 'annual', 3999, 'usd', 'year', 'price_annual_sample', 5),
        ('plan_lifetime', 'Ravn Ultra Lifetime', 'lifetime', 7999, 'usd', 'one_time', 'price_lifetime_sample', 10)
      ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS \`subscriptions\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`customer_id\` VARCHAR(64) NOT NULL,
        \`plan_id\` VARCHAR(64) NOT NULL,
        \`stripe_subscription_id\` VARCHAR(128) UNIQUE DEFAULT NULL,
        \`status\` ENUM('active', 'trialing', 'past_due', 'canceled', 'unpaid') NOT NULL DEFAULT 'active',
        \`current_period_start\` TIMESTAMP NULL DEFAULT NULL,
        \`current_period_end\` TIMESTAMP NULL DEFAULT NULL,
        \`cancel_at_period_end\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`plan_id\`) REFERENCES \`plans\`(\`id\`),
        INDEX \`idx_sub_stripe\` (\`stripe_subscription_id\`),
        INDEX \`idx_sub_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS \`licenses\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`license_key\` VARCHAR(64) NOT NULL UNIQUE,
        \`customer_id\` VARCHAR(64) NOT NULL,
        \`subscription_id\` VARCHAR(64) DEFAULT NULL,
        \`plan_type\` ENUM('monthly', 'annual', 'lifetime', 'trial') NOT NULL DEFAULT 'monthly',
        \`status\` ENUM('active', 'revoked', 'expired', 'suspended') NOT NULL DEFAULT 'active',
        \`max_activations\` INT UNSIGNED NOT NULL DEFAULT 3,
        \`activations_count\` INT UNSIGNED NOT NULL DEFAULT 0,
        \`signature\` TEXT NOT NULL,
        \`signed_payload\` TEXT NOT NULL,
        \`issued_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`expires_at\` TIMESTAMP NULL DEFAULT NULL,
        \`revoked_at\` TIMESTAMP NULL DEFAULT NULL,
        \`revocation_reason\` VARCHAR(255) DEFAULT NULL,
        FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE,
        INDEX \`idx_licenses_key\` (\`license_key\`),
        INDEX \`idx_licenses_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS \`license_activations\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`license_id\` VARCHAR(64) NOT NULL,
        \`device_id\` VARCHAR(128) NOT NULL,
        \`device_name\` VARCHAR(255) DEFAULT 'Mac',
        \`os_version\` VARCHAR(64) DEFAULT 'macOS',
        \`app_version\` VARCHAR(32) DEFAULT '1.0.0',
        \`ip_address\` VARCHAR(64) DEFAULT NULL,
        \`activated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`last_ping_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
        FOREIGN KEY (\`license_id\`) REFERENCES \`licenses\`(\`id\`) ON DELETE CASCADE,
        UNIQUE KEY \`uniq_license_device\` (\`license_id\`, \`device_id\`),
        INDEX \`idx_activations_device\` (\`device_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`event_type\` VARCHAR(64) NOT NULL,
        \`entity_id\` VARCHAR(64) NOT NULL,
        \`entity_type\` VARCHAR(32) NOT NULL,
        \`details\` JSON DEFAULT NULL,
        \`ip_address\` VARCHAR(64) DEFAULT NULL,
        \`user_agent\` TEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_audit_event\` (\`event_type\`),
        INDEX \`idx_audit_entity\` (\`entity_type\`, \`entity_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        connection.release();
        return true;
    }
    catch (error) {
        console.error('[Database] Connection check failed:', error);
        return false;
    }
}
