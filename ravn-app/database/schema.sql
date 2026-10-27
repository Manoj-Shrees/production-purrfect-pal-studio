-- ============================================================================
-- RAVN PRODUCTION LICENSING & MONETIZATION DATABASE SCHEMA
-- MySQL 8.0 Compatible with utf8mb4 collation
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `ravn_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ravn_db`;

-- 1. Customers
CREATE TABLE IF NOT EXISTS `customers` (
  `id` VARCHAR(64) PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(255) DEFAULT NULL,
  `stripe_customer_id` VARCHAR(128) UNIQUE DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_customers_email` (`email`),
  INDEX `idx_customers_stripe` (`stripe_customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Plans
CREATE TABLE IF NOT EXISTS `plans` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(128) NOT NULL,
  `tier` ENUM('monthly', 'annual', 'lifetime', 'family', 'trial') NOT NULL,
  `price_cents` INT UNSIGNED NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'usd',
  `billing_interval` VARCHAR(32) NOT NULL DEFAULT 'month',
  `stripe_price_id` VARCHAR(128) DEFAULT NULL,
  `max_devices` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Production Plans
INSERT INTO `plans` (`id`, `name`, `tier`, `price_cents`, `currency`, `billing_interval`, `stripe_price_id`, `max_devices`)
VALUES 
  ('plan_monthly', 'Ravn Pro Monthly', 'monthly', 499, 'usd', 'month', 'price_monthly_sample', 1),
  ('plan_annual', 'Ravn Pro Annual', 'annual', 3999, 'usd', 'year', 'price_annual_sample', 1),
  ('plan_lifetime', 'Ravn Ultra Lifetime', 'lifetime', 7999, 'usd', 'one_time', 'price_lifetime_sample', 2),
  ('plan_family', 'Ravn Family & Team Pass (5 Macs)', 'family', 12999, 'usd', 'one_time', 'price_family_sample', 5),
  ('plan_trial', 'Ravn Pro 7-Day Free Trial', 'trial', 0, 'usd', 'trial', NULL, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `max_devices` = VALUES(`max_devices`);

-- 3. Subscriptions
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `customer_id` VARCHAR(64) NOT NULL,
  `plan_id` VARCHAR(64) NOT NULL,
  `stripe_subscription_id` VARCHAR(128) UNIQUE DEFAULT NULL,
  `status` ENUM('active', 'trialing', 'past_due', 'canceled', 'unpaid') NOT NULL DEFAULT 'active',
  `current_period_start` TIMESTAMP NULL DEFAULT NULL,
  `current_period_end` TIMESTAMP NULL DEFAULT NULL,
  `cancel_at_period_end` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`),
  INDEX `idx_sub_stripe` (`stripe_subscription_id`),
  INDEX `idx_sub_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Cryptographic Licenses
CREATE TABLE IF NOT EXISTS `licenses` (
  `id` VARCHAR(64) PRIMARY KEY,
  `license_key` VARCHAR(64) NOT NULL UNIQUE,
  `customer_id` VARCHAR(64) NOT NULL,
  `subscription_id` VARCHAR(64) DEFAULT NULL,
  `plan_type` ENUM('monthly', 'annual', 'lifetime', 'family', 'trial') NOT NULL DEFAULT 'monthly',
  `status` ENUM('active', 'revoked', 'expired', 'suspended') NOT NULL DEFAULT 'active',
  `max_activations` INT UNSIGNED NOT NULL DEFAULT 1,
  `activations_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `signature` TEXT NOT NULL,
  `signed_payload` TEXT NOT NULL,
  `issued_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  `revoked_at` TIMESTAMP NULL DEFAULT NULL,
  `revocation_reason` VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  INDEX `idx_licenses_key` (`license_key`),
  INDEX `idx_licenses_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pre-provision VIP Customers and Pro Lifetime Licenses
INSERT INTO `customers` (`id`, `email`, `name`)
VALUES 
  ('cust_keshar_rai', 'keesshhaarr1234@gmail.com', 'Keshar Rai'),
  ('cust_manoj_shrees', 'manojshrees77@gmail.com', 'Manoj Shrees'),
  ('cust_tenzin_s', 'tenzins0025@gmail.com', 'Tenzin S')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `licenses` (
  `id`, `license_key`, `customer_id`, `subscription_id`, `plan_type`,
  `status`, `max_activations`, `signature`, `signed_payload`, `issued_at`, `expires_at`
) VALUES 
  ('lic_keshar_rai', 'RAVN-2LBM-ZJ9Y-RJX9-96UK', 'cust_keshar_rai', NULL, 'lifetime', 'active', 2, 'mG2eCEXmr8W//LK73I+x2kNKUI60M+CCSEQseRY7wS17H7MuJ/G9gnpVquIPdWQhhcp2gz9Pps0+N7MR+DqfCA==', 'key=RAVN-2LBM-ZJ9Y-RJX9-96UK|email=keesshhaarr1234@gmail.com|plan=lifetime|maxDevices=2|issuedAt=2026-10-27T13:39:03.111Z|expiresAt=never', NOW(), NULL),
  ('lic_manoj_shrees', 'RAVN-7UGF-E896-NC3A-PW2M', 'cust_manoj_shrees', NULL, 'lifetime', 'active', 5, 'N+olxrJ26MwqvibwvuOhBKr16tIcmccvot94Wr8WsojoXELYi7pWTql+mb0VPAclxmm8FUobEWosXAYLLjnVBQ==', 'key=RAVN-7UGF-E896-NC3A-PW2M|email=manojshrees77@gmail.com|plan=lifetime|maxDevices=5|issuedAt=2026-10-27T13:39:03.119Z|expiresAt=never', NOW(), NULL),
  ('lic_tenzin_s', 'RAVN-D26H-GRS8-JZSD-HDH7', 'cust_tenzin_s', NULL, 'lifetime', 'active', 2, 'EmWUi9VwsmH2nZA+b3UFfwUMmanvPKvV+DBfkcBDILRtPMb58SKTBoxtUucznYbtd5X9DevS0UXZ65ek9+fQAA==', 'key=RAVN-D26H-GRS8-JZSD-HDH7|email=tenzins0025@gmail.com|plan=lifetime|maxDevices=2|issuedAt=2026-10-27T22:25:22.399Z|expiresAt=never', NOW(), NULL)
ON DUPLICATE KEY UPDATE `status` = 'active', `max_activations` = VALUES(`max_activations`), `signature` = VALUES(`signature`), `signed_payload` = VALUES(`signed_payload`);

-- 5. Machine Activations (Hardware Binding)
CREATE TABLE IF NOT EXISTS `license_activations` (
  `id` VARCHAR(64) PRIMARY KEY,
  `license_id` VARCHAR(64) NOT NULL,
  `device_id` VARCHAR(128) NOT NULL,
  `device_name` VARCHAR(255) DEFAULT 'Mac',
  `os_version` VARCHAR(64) DEFAULT 'macOS',
  `app_version` VARCHAR(32) DEFAULT '1.0.0',
  `ip_address` VARCHAR(64) DEFAULT NULL,
  `activated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_ping_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uniq_license_device` (`license_id`, `device_id`),
  INDEX `idx_activations_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Audit & Security Logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `event_type` VARCHAR(64) NOT NULL,
  `license_key` VARCHAR(64) DEFAULT NULL,
  `device_id` VARCHAR(128) DEFAULT NULL,
  `ip_address` VARCHAR(64) DEFAULT NULL,
  `details` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_event` (`event_type`),
  INDEX `idx_audit_key` (`license_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
