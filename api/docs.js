const fs = require('fs');
const path = require('path');

// Lightweight handler to serve static docs without loading the full app
module.exports = async (req, res) => {
  try {
    const url = req.url || '/docs';
    if (url.startsWith('/openapi.json')) {
      const file = path.join(__dirname, '..', 'docs', 'openapi.json');
      if (!fs.existsSync(file)) return res.status(404).end('not found');
      res.setHeader('Content-Type', 'application/json');
      return res.end(fs.readFileSync(file));
    }

    // serve swagger.html at /docs
    if (url.startsWith('/docs')) {
      const file = path.join(__dirname, '..', 'docs', 'swagger.html');
      if (!fs.existsSync(file)) return res.status(404).end('not found');
      res.setHeader('Content-Type', 'text/html');
      return res.end(fs.readFileSync(file));
    }

    return res.status(404).end('not found');
  } catch (err) {
    console.error('docs handler error', err);
    res.statusCode = 500;
    return res.end('internal error');
  }
};
