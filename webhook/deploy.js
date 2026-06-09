'use strict';
const http     = require('http');
const crypto   = require('crypto');
const { exec } = require('child_process');

// ── Secrets from environment (never hard-code tokens in source) ──────────────
const SECRET      = process.env.WEBHOOK_SECRET  || 'Suw@s@77m@g@r!';
const GH_PAT      = process.env.GITHUB_PAT      || '';
const DOCKER_USER = process.env.DOCKER_USER      || 'manojshrees';
const DOCKER_PASS = process.env.DOCKER_PASS      || '';

// ── DB credentials (must match docker-compose.yml) ───────────────────────────
const DB_HOST     = 'db-c';
const DB_USER     = 'adminPPS';
const DB_PASS     = 'Toor@PPS@77admin*';   // ← fixed (was Toor@77admin*)
const DB_NAME     = 'purrfectpalstudiodb'; // ← fixed (was 'db')
const BACKUP_DIR  = '/backups';

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

// ── Decide whether to skip deploy ─────────────────────────────────────────────
function shouldIgnorePush(payload) {
  if (!payload.commits || !Array.isArray(payload.commits)) return false;

  for (const commit of payload.commits) {
    const msg = commit.message.toLowerCase();

    if (msg.includes('[skip-deploy]')) {
      console.log('[deploy] Skipping: [skip-deploy] in commit message.');
      return true;
    }

    // Only skip if ALL changed files are inside .webhook/
    const allFiles = [
      ...(commit.added    || []),
      ...(commit.modified || []),
      ...(commit.removed  || []),
    ];
    if (allFiles.some(f => !f.startsWith('.webhook/'))) {
      return false; // relevant file found — do not skip
    }
  }

  return true; // every commit touched only .webhook/ files
}

// ── Build the deploy shell command ───────────────────────────────────────────
//
//  Strategy (database-safe rolling update):
//  1. Take a mysqldump backup BEFORE pulling anything.
//  2. Validate the backup is non-empty.
//  3. Also snapshot the mysql_data Docker volume as a compressed tarball.
//  4. Pull latest code from GitHub.
//  5. Pull new Docker images.
//  6. Restart ONLY non-db services so mysql_data volume is never recreated.
//     (db container keeps running; its data volume is never touched by compose)
//
function buildDeployCommand() {
  const ts = '$(date +%F_%H-%M-%S)';

  // Build docker login string (only if creds provided)
  const dockerLogin = DOCKER_PASS
    ? `echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin && \\`
    : `echo "[deploy] Skipping docker login (no DOCKER_PASS set)" && \\`;

  // Build git remote URL (with or without PAT)
  const repoUrl = GH_PAT
    ? `https://${GH_PAT}@github.com/Manoj-Shrees/production-purrfect-pal-studio.git`
    : `https://github.com/Manoj-Shrees/production-purrfect-pal-studio.git`;

  return `
set -e

echo "[deploy] ── Step 1: Database backup ──────────────────────────────" && \\
BACKUP_SQL="${BACKUP_DIR}/db_backup_${ts}.sql" && \\
docker exec ${DB_HOST} mysqldump \\
  -u ${DB_USER} --password='${DB_PASS}' \\
  --single-transaction \\
  --no-tablespaces \\
  --routines \\
  --triggers \\
  ${DB_NAME} > "$BACKUP_SQL" && \\
BACKUP_BYTES=$(stat -c%s "$BACKUP_SQL" 2>/dev/null || stat -f%z "$BACKUP_SQL") && \\
echo "[deploy] DB dump size: $BACKUP_BYTES bytes" && \\
[ "$BACKUP_BYTES" -gt 1000 ] || (echo "[deploy] ERROR: DB backup is empty — aborting deploy!" && rm -f "$BACKUP_SQL" && exit 1) && \\
gzip "$BACKUP_SQL" && \\
echo "[deploy] DB backup saved: ${BACKUP_SQL}.gz" && \\

echo "[deploy] ── Step 2: Volume snapshot ───────────────────────────────" && \\
VOLUME_NAME=production-purrfect-pal-studio_mysql_data && \\
docker run --rm \\
  -v "$VOLUME_NAME":/volume:ro \\
  -v ${BACKUP_DIR}:/backup \\
  busybox \\
  tar czf /backup/volume_backup_${ts}.tar.gz -C /volume . && \\
echo "[deploy] Volume snapshot saved." && \\

echo "[deploy] ── Step 3: Pull latest code ──────────────────────────────" && \\
cd /app/production-purrfect-pal-studio && \\
git remote set-url origin "${repoUrl}" && \\
git fetch origin main && \\
git reset --hard origin/main && \\

echo "[deploy] ── Step 4: Pull Docker images ────────────────────────────" && \\
${dockerLogin}
docker compose pull && \\

echo "[deploy] ── Step 5: Restart services (DB preserved) ───────────────" && \\
docker compose up -d \\
  --force-recreate \\
  --remove-orphans \\
  --no-recreate db && \\
echo "[deploy] ── Deploy complete ─────────────────────────────────────────"
`.trim();
}

// ── HTTP server ───────────────────────────────────────────────────────────────
http.createServer((req, res) => {
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

      // Respond immediately so GitHub does not time out
      res.writeHead(200);
      res.end('Deploy triggered');

      exec(buildDeployCommand(), { shell: '/bin/sh' }, (err, stdout, stderr) => {
        if (err) {
          console.error('[deploy] FAILED:', err.message);
          console.error('[deploy] stderr:', stderr);
        } else {
          console.log('[deploy] SUCCESS');
        }
        if (stdout) console.log('[deploy] stdout:\n', stdout);
        if (stderr) console.warn('[deploy] stderr:\n', stderr);
      });

    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(3000, '0.0.0.0', () => console.log('[deploy] Webhook listener ready on port 3000'));
