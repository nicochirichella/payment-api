const log = require('./logger');
const https = require('https');
const http = require('http');
const datadog = require('./services/datadog_client');

log.debug('spin_up');

const config = require('./config');
const app = require('./app');
const fs = require('fs');
const path = require('path');
const bookshelf = require('./bookshelf');

const port = config.get('port');
let server;

if (config.get('ssl')) {
  const basePath = path.join(__dirname, '../cert');
  const privateKey = fs.readFileSync(`${basePath}/server.key`, 'utf8');
  const certificate = fs.readFileSync(`${basePath}/server.crt`, 'utf8');
  const credentials = { key: privateKey, cert: certificate };

  https.globalAgent.maxSockets = 100;

  server = https.createServer(credentials, app);
  server.listen(port, () => {
    log.info('server_listen', {
      env: config.get('env'),
      port,
      ssl: true,
      message: `Listening on port ${port} in ${config.get('env')} mode`,
    });
  });
} else {
  http.globalAgent.maxSockets = 100;

  server = http.createServer(app);
  server.listen(port, () => {
    log.info('server_listen', {
      env: config.get('env'),
      port,
      ssl: false,
      message: `Listening on port ${port} in ${config.get('env')} mode`,
    });
  });
}

if (config.get('env') === 'development') {
  log.warn('accept_invalid_ssl_certs');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function doShutdown() {
  process.nextTick(() => {
    process.exit(1);
  });
}

function shutdown() {
  server.close(() => {
    log.info('shut_down_requested');
    datadog.flush(doShutdown, doShutdown);
  });
}

bookshelf.knex.client.pool.on('error', (err) => {
  log.error('knex_pool_error', { err });
  process.nextTick(shutdown);
});
