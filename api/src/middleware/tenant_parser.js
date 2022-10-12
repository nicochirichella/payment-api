const UnauthorizedError = require('../errors').UnauthorizedError;
const Tenant = require('../models/tenant');

module.exports = function tenantParser(req, res, next) {
  req.context = req.context || {};
  const tenantName = req.params.tenantName;

  if (!tenantName) {
    return next(new Error('No tenant'));
  }

  return Tenant
    .forge({ name: tenantName })
    .fetch()
    .then((tenant) => {
      if (!tenant) {
        return next(new UnauthorizedError(`${tenantName} is an Invalid tenant`));
      }

      req.context.tenant = tenant;
      req.context.tenantId = tenant.get('id');
      return next();
    })
    .catch(next);
};
