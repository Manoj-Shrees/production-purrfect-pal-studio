import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { testDbConnection, initDatabaseTables } from './db/connection.js';
import { CryptoService } from './services/cryptoService.js';
import { apiRouter } from './routes/api.js';
import { DownloadController } from './controllers/downloadController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. Trust proxy (for Nginx reverse proxy headers)
app.set('trust proxy', 1);

// 2. Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible CDN & Stripe.js on web checkout page
    crossOriginEmbedderPolicy: false,
  })
);

// Restrict CORS to the production domain + any local dev origins
const allowedOrigins = [
  'https://ravn.purrfectpal.studio',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl, Swift URLSession)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} is not allowed.`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'stripe-signature'],
  })
);

// ── 3. Global Rate Limiters ──────────────────────────────────────────────────

// General API limiter: 200 requests/15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

// Trial endpoint: 5 free trials per IP per 24h (prevents key farming)
const trialLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Trial key limit reached for today. Please try again tomorrow.' },
  keyGenerator: (req) => req.ip || 'unknown',
  skip: (req) => {
    // Skip rate limit for admin requests (identified by API key header)
    return !!req.headers['x-api-key'];
  },
});

// License activation: 20 attempts per IP per hour (prevents brute-force)
const activationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many activation attempts. Please wait an hour before retrying.' },
});

// Checkout session creation: 30 per IP per hour (prevents Stripe abuse)
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many checkout requests. Please try again later.' },
});

// ── 4. Static Files (Glassmorphic Web Storefront) ───────────────────────────
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// Standalone Activation Portal Page Alias
app.get(['/activate', '/portal', '/license'], (_req: Request, res: Response) => {
  res.sendFile(path.resolve(publicDir, 'activate.html'));
});

// ── 5. Root Health Check ─────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  const dbOk = await testDbConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'healthy' : 'degraded',
    service: 'ravn-api',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ── 6. Direct Download & macOS Package Route ─────────────────────────────────
app.get(['/download/:filename?', '/assets/macos/:filename?'], (req: Request, res: Response) => {
  DownloadController.downloadFile(req, res);
});

// ── 7. Apply Rate Limiters to specific API endpoints ─────────────────────────
app.use('/api/v1/license/start-trial', trialLimiter);
app.use('/api/v1/license/activate', activationLimiter);
app.use('/api/v1/checkout', checkoutLimiter);
app.use('/api', generalLimiter);

// ── 8. API Routes ─────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 9. 404 Handler ───────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ── 10. Global Error Handler ──────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ── 11. Start Server ──────────────────────────────────────────────────────────
const server = app.listen(config.port, async () => {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║ 🚀 RAVN PRODUCTION LICENSING & STRIPE SERVER ACTIVE         ║`);
  console.log(`║ 📡 Port: ${config.port} | Mode: ${config.nodeEnv.padEnd(11)}                       ║`);
  console.log(`║ 🌐 Base URL: ${config.appBaseUrl.padEnd(46)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Startup warnings for misconfigured values
  if (config.appBaseUrl.includes('localhost') || config.appBaseUrl.includes('127.0.0.1')) {
    console.warn('⚠️  [CONFIG] APP_BASE_URL is set to localhost — Stripe redirects will fail for real customers!');
  }
  if (!config.stripe.webhookSecret || config.stripe.webhookSecret.startsWith('whsec_Mock')) {
    console.warn('⚠️  [CONFIG] STRIPE_WEBHOOK_SECRET is a placeholder! Real Stripe webhooks will FAIL signature verification.');
    console.warn('   → Get the real secret from: Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret');
  }
  if (config.admin.apiKey === 'ravn_master_admin_key_9988') {
    console.warn('⚠️  [CONFIG] ADMIN_API_KEY is the default weak key. Please set a strong random key in .env!');
  }

  CryptoService.initialize();
  const dbOk = await testDbConnection();
  if (dbOk) {
    console.log('✅ MySQL 8.0 Database Connected & Ready');
    await initDatabaseTables();
  } else {
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
