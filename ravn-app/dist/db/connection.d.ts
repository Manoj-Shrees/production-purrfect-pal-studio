import mysql from 'mysql2/promise';
import { Redis } from 'ioredis';
export declare const dbPool: mysql.Pool;
export declare const redis: Redis;
export declare function testDbConnection(): Promise<boolean>;
export declare function initDatabaseTables(): Promise<void>;
