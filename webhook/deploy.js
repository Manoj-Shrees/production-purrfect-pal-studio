const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const SECRET = 'Suw@s@77m@g@r!'; // Match GitHub webhook secret

function verifySignature(req, body) {
  const signature = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return signature === `sha256=${hmac}`;
}

function shouldIgnorePush(payload) {
  if (!payload.commits || !Array.isArray(payload.commits)) return false;

  for (const commit of payload.commits) {
    const msg = commit.message.toLowerCase();

    // ✅ Skip deploy if commit message includes [skip-deploy]
    if (msg.includes('[skip-deploy]')) {
      console.log('Ignoring push due to [skip-deploy] in commit message.');
      return true;
    }

    // ✅ Ignore if all files are in `.webhook/`
    const allFiles = [...commit.added, ...commit.modified, ...commit.removed];
    if (allFiles.some(file => !file.startsWith('.webhook/'))) {
      return false; // Found a relevant file
    }
  }

  return true; // All commits ignored
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!verifySignature(req, body)) {
        res.writeHead(403);
        return res.end('Forbidden: Invalid signature');
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch (e) {
        console.error('Invalid JSON:', e);
        res.writeHead(400);
        return res.end('Bad Request: Invalid JSON');
      }

      if (shouldIgnorePush(payload)) {
        res.writeHead(200);
        return res.end('Ignored: Commit skipped');
      }

      const deployCommand = `
                              cd /app/production-purrfect-pal-studio && \
                              git remote set-url origin https://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@github.com/Manoj-Shrees/production-purrfect-pal-studio.git && \
                              git pull origin main && \
                              docker login -u manojshrees -p dckr_pat_qdIJ5BjDGpqfvcLC-B5iEiflnGU && \  
                              docker-compose down && \
                               docker-compose pull && \
                              docker-compose up -d --build
                            `;


      // ✅ Trigger deploy
      exec(deployCommand, (err, stdout, stderr) => {
        if (err) {
          console.error('Deploy error:', err);
          res.writeHead(500);
          return res.end('Deploy failed');
        }
        console.log('Deploy success:', stdout);
        res.writeHead(200);
        res.end('Deploy successful');
      });
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(3000, '0.0.0.0', () => console.log('Webhook listener started on port 3000'));
