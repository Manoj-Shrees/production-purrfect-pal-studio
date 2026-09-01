import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { testDbConnection } from './db/connection.js';
import { CryptoService } from './services/cryptoService.js';
import { apiRouter } from './routes/api.js';
import { DownloadController } from './controllers/downloadController.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
// 1. Trust proxy (for Nginx reverse proxy headers)
app.set('trust proxy', 1);
// 2. Security Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allows flexible CDN & Stripe.js on web checkout page
    crossOriginEmbedderPolicy: false,
}));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'stripe-signature'],
}));
// 3. Static Files (Glassmorphic Web Storefront)
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));
// Standalone Activation Portal Page Alias
app.get(['/activate', '/portal', '/license'], (_req, res) => {
    res.sendFile(path.resolve(publicDir, 'activate.html'));
});
// 4. Root Health Check
app.get('/health', async (_req, res) => {
    const dbOk = await testDbConnection();
    res.status(dbOk ? 200 : 503).json({
        status: dbOk ? 'healthy' : 'degraded',
        service: 'ravn-api',
        database: dbOk ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
    });
});
// 5. Direct Download & macOS Package Route
app.get(['/download/:filename?', '/assets/macos/:filename?'], (req, res) => {
    DownloadController.downloadFile(req, res);
});
// 6. API Routes
app.use('/api', apiRouter);
// 6. 404 Handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});
// 7. Global Error Handler
app.use((err, _req, res, _next) => {
    console.error('[Global Error]:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});
// 8. Start Server
const server = app.listen(config.port, async () => {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log(`║ 🚀 RAVN PRODUCTION LICENSING & STRIPE SERVER ACTIVE         ║`);
    console.log(`║ 📡 Port: ${config.port} | Mode: ${config.nodeEnv.padEnd(11)}                       ║`);
    console.log(`║ 🌐 Base URL: ${config.appBaseUrl.padEnd(46)} ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    CryptoService.initialize();
    const dbOk = await testDbConnection();
    if (dbOk) {
        console.log('✅ MySQL 8.0 Database Connected & Ready');
    }
    else {
        console.warn('⚠️  MySQL Database connection pending or failed (check credentials/container)');
    }
});
// Graceful Shutdown
const shutdown = () => {
    console.log('\n[Server] Gracefully shutting down...');
    server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
    });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
