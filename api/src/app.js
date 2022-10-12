const _ = require('lodash');
const express = require('express');
const logger = require('./requestLogger');
require('./validations');
const config = require('./config');
const errors = require('./errors');
const requireTree = require('require-tree');
const log = require('./logger');

require('./moment-config');

const app = express();

const isDev = config.get('env') === 'development';

if (config.get('log.enabled')) {
  if (!isDev) {
    app.use(logger('production'));
  } else {
    app.use(logger('dev'));
  }
}

// Global middleware
log.trace('configure_middleware');

app.use(require('express-xml-bodyparser')({
  explicitArray: false,
  normalize: false,
  normalizeTags: false,
}));
app.use(require('body-parser').json());
app.use(require('body-parser').urlencoded({ extended: false }));
app.use(require('./middleware/express_validator')());
app.use(require('./middleware/troca_context'));
app.use(require('./middleware/cors'));

// Routes
log.trace('configure_routes');

app.use('/utils', require('./routes/utils'));

app.use('/:tenantName', require('./middleware/tenant_parser'));
app.use('/:tenantName', require('./middleware/api_key_parser'));

const routesV1 = requireTree('./routes/v1');
_.forIn(routesV1, (route, name) => {
  app.use(`/:tenantName/v1/${name}`, route);
});


// Error handlers
log.trace('configure_error_handlers');

app.use((req, res, next) => {
  next(new errors.NotFoundError());
});

if (config.get('log.enabled')) {
  app.use((err, req, res, next) => {
    if (!err.status || err.status >= 500) {
      req.log.warn('final_middleware.error_to_client', { err });
    } else {
      req.log.debug('final_middleware.non_500_error_to_client', { err });
    }
    next(err);
  });
}

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(err.status || 500)
    .json({
      code: err.code || 'generic_error',
      message: err.message || 'Internal server error',
      context: err.context || {},
      origin: `payment-api:${process.env.NODE_ENV || 'development'}`,
      previous: err.previous || null,
      devMessage: err.devMessage || '',
    });
});

log.trace('configure_complete');

module.exports = app;
