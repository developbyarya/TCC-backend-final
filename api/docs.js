const fs = require('fs');
const path = require('path');

// Lightweight handler to serve static docs without loading the full app.
// For openapi.json we inject a runtime `servers` entry derived from the
// incoming request so the Swagger UI can call the correct host. This
// avoids initializing the full Express app or any DB/Redis connections.
module.exports = async (req, res) => {
  try {
    const url = req.url || '/docs';
    // Serve dynamic OpenAPI JSON with adjusted servers
    if (url.startsWith('/openapi.json')) {
      const file = path.join(__dirname, '..', 'docs', 'openapi.json');
      if (!fs.existsSync(file)) return res.status(404).end('not found');

      const raw = fs.readFileSync(file, 'utf8');
      let spec;
      try {
        spec = JSON.parse(raw);
      } catch (e) {
        console.error('failed to parse openapi.json', e);
        return res.status(500).end('invalid openapi.json');
      }

      // Derive origin from X-Forwarded headers (Vercel) or request
      const proto = req.headers['x-forwarded-proto'] || (req.protocol || 'https');
      const host = req.headers['x-forwarded-host'] || req.headers['host'];
      if (host) {
        spec.servers = [{ url: `${proto}://${host}` }];
      }

      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(spec));
    }

    // serve swagger.html at /docs
    if (url.startsWith('/docs')) {
      const file = path.join(__dirname, '..', 'docs', 'swagger.html');
      if (!fs.existsSync(file)) return res.status(404).end('not found');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(fs.readFileSync(file, 'utf8'));
    }

    return res.status(404).end('not found');
  } catch (err) {
    console.error('docs handler error', err);
    res.statusCode = 500;
    return res.end('internal error');
  }
};
