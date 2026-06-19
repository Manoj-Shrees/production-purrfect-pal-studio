'use strict';
const http     = require('http');
const crypto   = require('crypto');
const { spawn } = require('child_process');

// ── Secrets from environment (never hard-code tokens in source) ──────────────
const SECRET      = process.env.WEBHOOK_SECRET  || 'Suw@s@77m@g@r!';
const GH_PAT      = process.env.GITHUB_PAT      || '';
const DOCKER_USER = process.env.DOCKER_USER      || 'manojshrees';
const DOCKER_PASS = process.env.DOCKER_PASS      || '';

// ── DB credentials (must match docker-compose.yml) ───────────────────────────
const DB_HOST     = 'db-c';
const DB_USER     = 'adminPPS';
const DB_PASS     = 'Toor@PPS@77admin*';
const DB_NAME     = 'purrfectpalstudiodb';
const BACKUP_DIR  = '/backups';

// ── Prevent concurrent deploys ────────────────────────────────────────────────
let deployInProgress = false;

// ── Signature verification ────────────────────────────────────────────────────
function verifySignature(req, body) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${hmac}`)
  );
}

// ── Decide whether to skip deploy (GitHub push events only) ──────────────────
function shouldIgnorePush(payload) {
  if (!payload.commits || !Array.isArray(payload.commits)) return false;
  for (const commit of payload.commits) {
    const msg = commit.message.toLowerCase();
    if (msg.includes('[skip-deploy]')) {
      console.log('[deploy] Skipping: [skip-deploy] in commit message.');
      return true;
    }
    const allFiles = [
      ...(commit.added    || []),
      ...(commit.modified || []),
      ...(commit.removed  || []),
    ];
    if (allFiles.some(f => !f.startsWith('.webhook/'))) return false;
  }
  return true;
}

// ── Build the deploy shell script arguments ───────────────────────────────────
//
//  Strategy (database-safe rolling update):
//  1. mysqldump backup BEFORE pulling anything.
//  2. Validate backup is non-empty.
//  3. Snapshot the mysql_data Docker volume as a compressed tarball.
//  4. Pull latest code from GitHub.
//  5. Pull new Docker images.
//  6. Restart ONLY non-db services so mysql_data volume is never recreated.
//
function buildDeployScript() {
  const dockerLogin = DOCKER_PASS
    ? `echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin`
    : `echo "[deploy] Skipping docker login (no DOCKER_PASS set)"`;

  const repoUrl = GH_PAT
    ? `https://${GH_PAT}@github.com/Manoj-Shrees/production-purrfect-pal-studio.git`
    : `https://github.com/Manoj-Shrees/production-purrfect-pal-studio.git`;

  // Return as inline script string for /bin/sh -c
  return `
set -e

echo "[deploy] ── Step 1: Database backup ──────────────────────────────"
TS=$(date +%F_%H-%M-%S)
BACKUP_SQL="${BACKUP_DIR}/db_backup_$TS.sql"
docker exec ${DB_HOST} mysqldump \\
  -u ${DB_USER} --password='${DB_PASS}' \\
  --single-transaction \\
  --no-tablespaces \\
  --routines \\
  --triggers \\
  ${DB_NAME} > "$BACKUP_SQL"
BACKUP_BYTES=$(stat -c%s "$BACKUP_SQL" 2>/dev/null || stat -f%z "$BACKUP_SQL")
echo "[deploy] DB dump size: $BACKUP_BYTES bytes"
[ "$BACKUP_BYTES" -gt 1000 ] || (echo "[deploy] ERROR: DB backup is empty — aborting deploy!" && rm -f "$BACKUP_SQL" && exit 1)
gzip "$BACKUP_SQL"
echo "[deploy] DB backup saved: $BACKUP_SQL.gz"

echo "[deploy] ── Step 2: Volume snapshot ───────────────────────────────"
VOLUME_NAME=production-purrfect-pal-studio_mysql_data
docker run --rm \\
  -v "$VOLUME_NAME":/volume:ro \\
  -v ${BACKUP_DIR}:/backup \\
  busybox \\
  tar czf /backup/volume_backup_$TS.tar.gz -C /volume .
echo "[deploy] Volume snapshot saved."

echo "[deploy] ── Step 3: Pull latest code ──────────────────────────────"
cd /app/production-purrfect-pal-studio
git remote set-url origin "${repoUrl}"
git fetch origin main
git reset --hard origin/main

echo "[deploy] ── Step 4: Pull Docker images ────────────────────────────"
${dockerLogin}
docker-compose pull

echo "[deploy] ── Step 5: Restart services (DB preserved) ───────────────"
docker-compose up -d \\
  --force-recreate \\
  --remove-orphans \\
  --no-recreate db

echo "[deploy] ── Deploy complete ─────────────────────────────────────────"
`.trim();
}

// ── Run deploy and stream output via SSE ─────────────────────────────────────
//
//  Spawns /bin/sh with the deploy script and streams stdout/stderr line-by-line
//  as Server-Sent Events. The SSE stream ends with either:
//    event: done    — deploy completed successfully
//    event: error   — deploy failed (exit code != 0)
//
function runDeployWithStream(res) {
  if (deployInProgress) {
    res.write(`data: [deploy] ⚠️  A deployment is already in progress. Please wait.\n\n`);
    res.write(`event: error\ndata: already_running\n\n`);
    return;
  }

  deployInProgress = true;
  const script = buildDeployScript();

  res.write(`data: [deploy] 🚀 Starting deployment sequence...\n\n`);

  const proc = spawn('/bin/sh', ['-c', script], {
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  // Stream stdout lines as SSE data events
  let stdoutBuf = '';
  proc.stdout.on('data', chunk => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop(); // keep partial line in buffer
    for (const line of lines) {
      if (line.trim()) {
        res.write(`data: ${line}\n\n`);
      }
    }
  });

  // Stream stderr lines as SSE data events (docker pull outputs to stderr)
  let stderrBuf = '';
  proc.stderr.on('data', chunk => {
    stderrBuf += chunk.toString();
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop();
    for (const line of lines) {
      if (line.trim()) {
        res.write(`data: [stderr] ${line}\n\n`);
      }
    }
  });

  proc.on('close', (code) => {
    // Flush remaining buffered output
    if (stdoutBuf.trim()) res.write(`data: ${stdoutBuf}\n\n`);
    if (stderrBuf.trim()) res.write(`data: [stderr] ${stderrBuf}\n\n`);

    deployInProgress = false;

    if (code === 0) {
      res.write(`data: [deploy] ✅ All steps completed successfully!\n\n`);
      res.write(`event: done\ndata: success\n\n`);
    } else {
      res.write(`data: [deploy] ❌ Deploy script exited with code ${code}\n\n`);
      res.write(`event: error\ndata: exit_${code}\n\n`);
    }
    res.end();
  });

  proc.on('error', (err) => {
    deployInProgress = false;
    res.write(`data: [deploy] ❌ Failed to spawn deploy process: ${err.message}\n\n`);
    res.write(`event: error\ndata: spawn_failed\n\n`);
    res.end();
  });

  // If client disconnects, kill the process
  res.on('close', () => {
    if (!proc.killed) {
      proc.kill('SIGTERM');
      deployInProgress = false;
    }
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────
http.createServer((req, res) => {

  // ── POST /deploy — Legacy GitHub webhook endpoint ─────────────────────────
  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {

      if (!verifySignature(req, body)) {
        console.warn('[deploy] Rejected: invalid HMAC signature.');
        res.writeHead(403);
        return res.end('Forbidden: Invalid signature');
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch (e) {
        console.error('[deploy] Invalid JSON:', e.message);
        res.writeHead(400);
        return res.end('Bad Request: Invalid JSON');
      }

      if (shouldIgnorePush(payload)) {
        res.writeHead(200);
        return res.end('Ignored: commit skipped');
      }

      console.log('[deploy] Push accepted — starting deployment ...');
      res.writeHead(200);
      res.end('Deploy triggered');

      // Fire-and-forget (legacy mode for GitHub webhook)
      const proc = spawn('/bin/sh', ['-c', buildDeployScript()]);
      proc.stdout.on('data', d => process.stdout.write(d));
      proc.stderr.on('data', d => process.stderr.write(d));
      proc.on('close', code => {
        if (code === 0) console.log('[deploy] SUCCESS');
        else console.error('[deploy] FAILED with exit code', code);
      });
    });

  // ── GET /deploy-stream — Admin app SSE streaming endpoint ────────────────
  } else if (req.method === 'GET' && req.url === '/deploy-stream') {

    // Validate the same HMAC secret passed as query-param or header
    const authHeader = req.headers['x-hub-signature-256'];
    const testHmac   = crypto.createHmac('sha256', SECRET).update('admin-stream').digest('hex');
    const expected   = `sha256=${testHmac}`;
    const authorized = authHeader && crypto.timingSafeEqual(
      Buffer.from(authHeader.padEnd(expected.length)),
      Buffer.from(expected.padEnd(authHeader.length))
    );

    if (!authorized) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden: Invalid token');
    }

    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    runDeployWithStream(res);

  // ── GET /deploy-status — Quick check if a deploy is running ──────────────
  } else if (req.method === 'GET' && req.url === '/deploy-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ inProgress: deployInProgress }));

  // ── GET /health ───────────────────────────────────────────────────────────
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');

  } else {
    res.writeHead(404);
    res.end('Not Found');
  }

}).listen(3000, '0.0.0.0', () => console.log('[deploy] Webhook listener ready on port 3000'));
