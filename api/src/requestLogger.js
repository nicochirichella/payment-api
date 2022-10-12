const logger = require('morgan');
const config = require('./config');

logger.token('instance-id', (req) => {
  return req.instanceId;
});

logger.token('pid', () => {
  return process.pid;
});

logger.token('req-info', (req) => {
  const context = req.context || {};
  let logString = '';

  logString += context.flow_reference || 'EMPTY-FLOW-REFERENCE';
  logString += ` ${context.request_id}`;

  return logString;
});

function jsonFormat(tokens, req, res) {
  return JSON.stringify({
    'remote-address': tokens['remote-addr'](req, res),
    'time': tokens.date(req, res, 'iso'),
    'method': tokens.method(req, res),
    'url': tokens.url(req, res),
    'http-version': tokens['http-version'](req, res),
    'status-code': tokens.status(req, res),
    'content-length': tokens.res(req, res, 'content-length'),
    'referrer': tokens.referrer(req, res),
    'user-agent': tokens['user-agent'](req, res),
    'instance': tokens['instance-id'](req, res),
    'pid': tokens.pid(req, res),
    'tenant': config.get('env'),
    'log_type': 'access',
  });
}

logger.format('production', jsonFormat);

function getLogger() {
  return logger;
}

module.exports = getLogger();
