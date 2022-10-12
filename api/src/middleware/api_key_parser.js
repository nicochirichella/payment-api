const UnauthorizedError = require('../errors').UnauthorizedError;

module.exports = function apiKeyParser(req, res, next) {
  req.context.authenticated = false;
  const apiKey = req.get('X-Api-Key') || req.query.api_key;

  if (!req.context.tenant) {
    return next(new UnauthorizedError('Tenant not specified'));
  }

  if (req.context.tenant.get('api_key') !== apiKey) {
    return next();
  }

  req.context.apiKey = apiKey;
  req.context.authenticated = true;

  return next();
};
