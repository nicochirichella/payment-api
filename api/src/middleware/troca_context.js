const log = require('../logger');
const cuid = require('cuid');

module.exports = function trocaContext(req, res, next) {
  req.context = {
    authenticated: false,
    flow_reference: req.headers['x-flow-reference'],
    request_id: cuid(),
  };
  req.log = log.child({
    request_id: req.context.request_id,
    flow_reference: req.context.flow_reference,
  });

  next();
};
