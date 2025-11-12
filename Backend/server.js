require('dotenv').config({ path: __dirname + '/.env' });
const config = require('./src/config');
const { createApp, initializeInfrastructure } = require('./src/app');

async function startServer() {
  await initializeInfrastructure();
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Backend escuchando en http://localhost:${config.port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Error al inicializar la aplicación', err);
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
