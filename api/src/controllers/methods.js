const _ = require('lodash');
const NotFoundError = require('../errors').NotFoundError;
const InvalidParameters = require('../errors').InvalidParameters;
const PaymentMethod = require('../models/payment_method');
const PaymentMethodGatewayMethod = require('../models/payment_method_gateway_method');
const view = require('../views/payment_method');
const installmentInfo = require('../views/installment_info');
const log = require('../logger');
const Promise = require('bluebird');

module.exports = {
  fetch: function fetch(req, res, next) {
    const type = req.params.id;
    const tenantId = req.context.tenant.get('id');

    PaymentMethod
      .forge({ type, tenant_id: tenantId })
      .fetch()
      .then((method) => {
        if (!method) {
          return next(new NotFoundError());
        }

        req.context.paymentMethod = method;
        return next();
      })
      .catch(next)
      .done();
  },

  getAll: function getAll(req, res, next) {
    const filterString = req.query.filters;
    const relations = req.query.relations ? req.query.relations.split(',') : [];

    let filter = { enabled: true };
    if (filterString === 'enabled:all') {
      filter = {};
    }

    req.context.tenant
      .related('paymentMethods')
      .query({ where: filter })
      .fetch()
      .then((methods) => {
        return Promise.all(methods.map(m => view(m, { relations })));
      })
      .then((methodsJsons) => {
        res.json(_.sortBy(methodsJsons, 'id'));
      })
      .catch(next)
      .done();
  },

  update: function updateMethod(req, res, next) {
    return Promise.resolve(req.body || {})
      .then((body) => {
        if (!body.gatewayMethod) {
          return body;
        }

        return req.context.paymentMethod.related('validGatewayMethods')
          .query({ where: { type: body.gatewayMethod } })
          .fetchOne()
          .then((gm) => {
            if (!gm) {
              throw new InvalidParameters(['gatewayMethod']);
            }
            req.context.paymentMethod.updateGatewayMethodsConfiguration(gm)
              .catch((e) => {
                log.error('methods.update_method.cant_update_gateway_mehtod_configuration', { error: e });
              });

            const newBody = _.merge({}, body, {
              gateway_method_id: gm.get('id'),
            });
            delete newBody.gatewayMethod;
            return newBody;
          });
      })
      .then(body => req.context.paymentMethod.update(body))
      .then((pm) => {
        req.context.paymentMethod = pm;
        next();
      })
      .catch(next)
      .done();
  },

  returnView: function returnView(req, res, next) {
    const pm = req.context.paymentMethod;
    const relations = req.query.relations ? req.query.relations.split(',') : [];
    return view(pm, { relations })
      .then((jsonView) => {
        res.json(jsonView);
      })
      .catch(next)
      .done();
  },

  getConfig(req, res, next) {
    const paymentMethod = req.context.paymentMethod;
    paymentMethod.getRelation('gatewayMethod')
      .then(gm => gm.getConfig())
      .then(config => res.json(config, 200).send())
      .catch(next);
  },

  getInstallments(req, res, next) {
    req.context.tenant
      .related('paymentMethods')
      .query({ where: { enabled: true } })
      .fetch()
      .then(paymentMethods =>
        Promise
          .map(_.sortBy(paymentMethods.toArray(), 'id'), pm => pm.getRelation('gatewayMethod')
            .then(gm => gm.getRelation('interestRates')
              .then(rates => installmentInfo(pm, rates)))))
      .then(response => res.json(response))
      .catch(next)
      .done();
  },
};
