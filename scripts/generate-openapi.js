const fs = require('fs');
const path = require('path');

// Generate docs/openapi.json using swagger-jsdoc by scanning route files.
// This script is safe to run during CI/build and doesn't initialize the app.
async function main() {
  const swaggerJSDoc = require('swagger-jsdoc');

  const swaggerDefinition = {
    openapi: '3.0.0',
    info: { title: 'TCC Backend API', version: '1.0.0' },
    servers: [{ url: '/' }],
  };

  const options = {
    swaggerDefinition,
    apis: [path.join(__dirname, '..', 'src', 'routes', '*.js')],
  };

  const spec = swaggerJSDoc(options);

  const outDir = path.join(__dirname, '..', 'docs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, 'openapi.json');
  fs.writeFileSync(outFile, JSON.stringify(spec, null, 2), 'utf8');
  console.log('Wrote', outFile);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
