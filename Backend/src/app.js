const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const uiRouter = require('./routes/ui');
const { initPool } = require('./services/db');
const { ensureDefaultAdmin } = require('./services/rbac');

async function initializeInfrastructure() {
  await initPool();
  await ensureDefaultAdmin();
}

function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({
    origin: config.frontendOrigins,
    credentials: true,
  }));

  const frontendDir = path.resolve(__dirname, '..', '..', 'frontend');
  app.use('/assets', express.static(path.join(frontendDir, 'assets')));
  app.use('/components', express.static(path.join(frontendDir, 'components')));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  app.use('/', uiRouter);
  app.use('/api', routes);

  app.use((err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    if (res.headersSent) {
      return res.end();
    }
    const status = err.status || 500;
    const message = err.message || 'Error interno';
    return res.status(status).json({ error: 'INTERNAL_ERROR', message });
  });

  return app;
}

module.exports = {
  createApp,
  initializeInfrastructure,
};
