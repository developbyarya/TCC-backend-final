// Vercel serverless function entrypoint for the Express app
// Imports the existing createApp() and exposes a compatible handler
const serverless = require('serverless-http');
const { createApp } = require('../src/app');

const app = createApp();

module.exports = serverless(app);
