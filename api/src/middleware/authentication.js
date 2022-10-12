const UnauthorizedError = require('../errors').UnauthorizedError;

module.exports = {
  authed(req, res, next) {
    if (!req.context.authenticated) {
      return next(new UnauthorizedError('API key does not match Tenant'));
    }
    return next();
  },
};
