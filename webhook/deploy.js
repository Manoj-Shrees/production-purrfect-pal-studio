'use strict';
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ── Secrets from environment (never hard-code tokens in source) ──────────────
const SECRET = process.env.WEBHOOK_SECRET || 'Suw@s@77m@g@r!';
const GH_PAT = process.env.GITHUB_PAT || '';
const DOCKER_USER = process.env.DOCKER_USER || 'manojshrees';
const DOCKER_PASS = process.env.DOCKER_PASS || '';

// ── DB credentials (must match docker-compose.yml) ───────────────────────────
const DB_HOST = 'db-c';
const DB_USER = 'adminPPS';
const DB_PASS = 'Toor@PPS@77admin*';
const DB_NAME = 'purrfectpalstudiodb';
const BACKUP_DIR = '/backups';

// ── Prevent concurrent deploys & manage logging ──────────────────────────────
let deployInProgress = false;
let deployLogsHistory = [];
let activeStreams = [];
let deployProcess = null;

function broadcast(eventType, dataText) {
  let chunk = '';
  if (eventType === 'data') {
    chunk = `data: ${dataText}\n\n`;
  } else {
    chunk = `event: ${eventType}\ndata: ${dataText}\n\n`;
  }

  // Limit history size to 2000 lines to prevent memory issues
  if (deployLogsHistory.length > 2000) {
    deployLogsHistory.shift();
  }
  deployLogsHistory.push({ eventType, dataText });

  for (const res of activeStreams) {
    try {
      res.write(chunk);
    } catch (err) {
      console.error('[deploy] Error writing to active stream:', err.message);
    }
  }
}

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
      ...(commit.added || []),
      ...(commit.modified || []),
      ...(commit.removed || []),
    ];
    if (allFiles.some(f => !f.startsWith('.webhook/'))) return false;
  }
}

function loadEnvFile(filePath) {
  const fs = require('fs');
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      env[key] = val;
    });
    return env;
  } catch (err) {
    console.error('[deploy] Error loading env file:', err.message);
    return {};
  }
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
  const localEnv = loadEnvFile('/app/production-purrfect-pal-studio/.env');
  const dockerUser = localEnv.DOCKER_USER || DOCKER_USER;
  const dockerPass = localEnv.DOCKER_PASS || DOCKER_PASS;

  const dockerLogin = dockerPass
    ? `echo "${dockerPass}" | docker login -u "${dockerUser}" --password-stdin`
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

// ── Run deploy ────────────────────────────────────────────────────────────────
function runDeploy() {
  if (deployInProgress) {
    return;
  }

  deployInProgress = true;
  deployLogsHistory = []; // Clear old logs when starting a new deploy

  console.log('[deploy] Starting deployment sequence...');
  broadcast('data', '[deploy] 🚀 Starting deployment sequence...');

  const script = buildDeployScript();
  deployProcess = spawn('/bin/sh', ['-c', script], {
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  // Stream stdout lines
  let stdoutBuf = '';
  deployProcess.stdout.on('data', chunk => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop(); // keep partial line in buffer
    for (const line of lines) {
      if (line.trim()) {
        broadcast('data', line);
      }
    }
  });

  // Stream stderr lines (docker pull outputs to stderr)
  let stderrBuf = '';
  deployProcess.stderr.on('data', chunk => {
    stderrBuf += chunk.toString();
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop();
    for (const line of lines) {
      if (line.trim()) {
        broadcast('data', `[stderr] ${line}`);
      }
    }
  });

  deployProcess.on('close', (code) => {
    // Flush remaining buffered output
    if (stdoutBuf.trim()) broadcast('data', stdoutBuf);
    if (stderrBuf.trim()) broadcast('data', `[stderr] ${stderrBuf}`);

    deployInProgress = false;
    deployProcess = null;

    if (code === 0) {
      console.log('[deploy] SUCCESS');
      broadcast('data', '[deploy] ✅ All steps completed successfully!');
      broadcast('done', 'success');
    } else {
      console.error(`[deploy] FAILED with exit code ${code}`);
      broadcast('data', `[deploy] ❌ Deploy script exited with code ${code}`);
      broadcast('error', `exit_${code}`);
    }

    // Close all streams connected for this deployment run
    const streamsToClose = [...activeStreams];
    activeStreams = [];
    for (const res of streamsToClose) {
      try {
        res.end();
      } catch (err) {
        console.error('[deploy] Error ending client stream:', err.message);
      }
    }
  });

  deployProcess.on('error', (err) => {
    deployInProgress = false;
    deployProcess = null;
    console.error('[deploy] Spawn error:', err);
    broadcast('data', `[deploy] ❌ Failed to spawn deploy process: ${err.message}`);
    broadcast('error', 'spawn_failed');

    const streamsToClose = [...activeStreams];
    activeStreams = [];
    for (const res of streamsToClose) {
      try {
        res.end();
      } catch (err) {
        console.error('[deploy] Error ending client stream on error:', err.message);
      }
    }
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────
http.createServer((req, res) => {
  // Normalize the URL path by stripping query parameters and trailing slashes
  const urlPath = req.url.split('?')[0].replace(/\/$/, '') || '/';
  console.log(`[deploy] 📥 Incoming request: ${req.method} ${req.url} (resolved path: ${urlPath})`);

  // ── POST /deploy — Webhook trigger (GitHub or direct API) ───────────────────
  if (req.method === 'POST' && urlPath === '/deploy') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {

      if (!verifySignature(req, body)) {
        console.warn('[deploy] Rejected POST /deploy: invalid HMAC signature.');
        res.writeHead(403);
        return res.end('Forbidden: Invalid signature');
      }

      let payload = {};
      try {
        if (body.trim()) {
          payload = JSON.parse(body);
        }
      } catch (e) {
        // Fallback for non-JSON payloads
      }

      if (shouldIgnorePush(payload)) {
        res.writeHead(200);
        return res.end('Ignored: commit skipped');
      }

      if (deployInProgress) {
        console.warn('[deploy] Rejected POST /deploy: deployment is already in progress.');
        res.writeHead(409);
        return res.end('Conflict: deployment already in progress');
      }

      console.log('[deploy] Deploy requested via POST /deploy — starting execution...');
      res.writeHead(200);
      res.end('Deploy triggered');

      runDeploy();
    });

  // ── GET /deploy-stream — SSE logging endpoint ──────────────────────────────
  } else if (req.method === 'GET' && urlPath === '/deploy-stream') {

    const authHeader = req.headers['x-hub-signature-256'];
    const testHmac = crypto.createHmac('sha256', SECRET).update('admin-stream').digest('hex');
    const expected = `sha256=${testHmac}`;
    const authorized = authHeader && crypto.timingSafeEqual(
      Buffer.from(authHeader.padEnd(expected.length)),
      Buffer.from(expected.padEnd(authHeader.length))
    );

    if (!authorized) {
      console.warn('[deploy] GET /deploy-stream rejected: unauthorized.');
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden: Invalid token');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });

    // Write all buffered log history to catch this client up
    for (const log of deployLogsHistory) {
      let chunk = '';
      if (log.eventType === 'data') {
        chunk = `data: ${log.dataText}\n\n`;
      } else {
        chunk = `event: ${log.eventType}\ndata: ${log.dataText}\n\n`;
      }
      res.write(chunk);
    }

    if (deployInProgress) {
      // Stream is in progress, just add to active listeners
      activeStreams.push(res);
    } else {
      // No active deploy, start a new deployment and add client to active streams
      activeStreams.push(res);
      runDeploy();
    }

    res.on('close', () => {
      activeStreams = activeStreams.filter(s => s !== res);
      console.log(`[deploy] SSE stream client disconnected. Remaining active streams: ${activeStreams.length}`);
    });

  // ── GET /deploy-status ─────────────────────────────────────────────────────
  } else if (req.method === 'GET' && urlPath === '/deploy-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ inProgress: deployInProgress }));

  // ── GET /active-slot ───────────────────────────────────────────────────────
  } else if (req.method === 'GET' && urlPath === '/active-slot') {
    const fs = require('fs');
    const CONF_PATH = '/app/production-purrfect-pal-studio/nginx/conf.d/active_backend.conf';
    try {
      if (!fs.existsSync(CONF_PATH)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, active: 'backend-1' }));
      }
      const content = fs.readFileSync(CONF_PATH, 'utf8');
      const backend2Active = /^\s*server\s+backend-2:8080;/m.test(content) && !/^\s*#\s*server\s+backend-2:8080;/m.test(content);
      const activeSlot = backend2Active ? 'backend-2' : 'backend-1';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, active: activeSlot }));
    } catch (err) {
      console.error('[deploy] Error reading active slot:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }

  // ── POST /switch-slot ──────────────────────────────────────────────────────
  } else if (req.method === 'POST' && urlPath === '/switch-slot') {
    const fs = require('fs');
    const { exec } = require('child_process');
    const CONF_PATH = '/app/production-purrfect-pal-studio/nginx/conf.d/active_backend.conf';
    try {
      let content = '';
      if (fs.existsSync(CONF_PATH)) {
        content = fs.readFileSync(CONF_PATH, 'utf8');
      }
      const backend2Active = /^\s*server\s+backend-2:8080;/m.test(content) && !/^\s*#\s*server\s+backend-2:8080;/m.test(content);
      const currentSlot = backend2Active ? 'backend-2' : 'backend-1';
      const newSlot = currentSlot === 'backend-1' ? 'backend-2' : 'backend-1';
      
      let newConfig = '';
      if (newSlot === 'backend-1') {
        newConfig = `# Active upstream configuration — blue slot
upstream backend {
    server backend-1:8080;
    # server backend-2:8080;
    keepalive 32;
}
`;
      } else {
        newConfig = `# Active upstream configuration — green slot
upstream backend {
    # server backend-1:8080;
    server backend-2:8080;
    keepalive 32;
}
`;
      }
      fs.writeFileSync(CONF_PATH, newConfig, 'utf8');
      
      // Reload Nginx — try docker exec first (requires docker.sock mount),
      // fall back to docker kill -s HUP which also works when socket is available.
      const reloadCmd = `docker exec nginx-proxy nginx -s reload 2>&1 || docker kill -s HUP nginx-proxy 2>&1`;
      exec(reloadCmd, { timeout: 15000 }, (err, stdout, stderr) => {
        const combinedOut = [stdout, stderr].filter(Boolean).join(' ').trim();
        if (err) {
          const detail = combinedOut || err.message;
          console.error('[deploy] Failed to reload Nginx:', detail);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            error: `Nginx reload failed: ${detail}. Check that the webhook container has access to /var/run/docker.sock and nginx-proxy is the correct container name.`
          }));
        }
        console.log('[deploy] Nginx reloaded successfully. Output:', combinedOut || '(none)');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          active: newSlot,
          message: `Successfully redirected client traffic to ${newSlot}`
        }));
      });
    } catch (err) {
      console.error('[deploy] Error switching active slot:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }

  // ── POST /docker-login ─────────────────────────────────────────────────────
  } else if (req.method === 'POST' && urlPath === '/docker-login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!verifySignature(req, body)) {
        res.writeHead(401);
        return res.end('Unauthorized');
      }
      try {
        const { username, secret } = JSON.parse(body || '{}');
        if (!username || !secret) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Username and secret are required' }));
        }

        const fs = require('fs');
        const envPath = '/app/production-purrfect-pal-studio/.env';
        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf8');
        }

        let lines = envContent.split('\n');
        let userSet = false;
        let passSet = false;

        lines = lines.map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('DOCKER_USER=')) {
            userSet = true;
            return `DOCKER_USER=${username}`;
          }
          if (trimmed.startsWith('DOCKER_PASS=')) {
            passSet = true;
            return `DOCKER_PASS=${secret}`;
          }
          return line;
        });

        if (!userSet) {
          lines.push(`DOCKER_USER=${username}`);
        }
        if (!passSet) {
          lines.push(`DOCKER_PASS=${secret}`);
        }

        fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
        console.log('[deploy] Docker credentials updated in .env successfully.');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Docker credentials updated successfully' }));
      } catch (err) {
        console.error('[deploy] Error updating docker login:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });

  // ── GET /health ────────────────────────────────────────────────────────────
  } else if (req.method === 'GET' && urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');

  } else {
    res.writeHead(404);
    res.end('Not Found');
  }

}).listen(3000, '0.0.0.0', () => console.log('[deploy] Webhook listener ready on port 3000'));
