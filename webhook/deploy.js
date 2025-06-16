const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const SECRET = 'Suw@s@77m@g@r!'; // Use the same secret as in GitHub webhook

function verifySignature(req, body) {
  const signature = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return signature === `sha256=${hmac}`;
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
      
      // Pull latest code and rebuild Docker
      exec('cd production-purrfect-pal-studio && git pull && docker-compose up -d --build', (err, stdout, stderr) => {
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
}).listen(3000, '0.0.0.0', () => console.log('Webhook listener started on port 3000'))
