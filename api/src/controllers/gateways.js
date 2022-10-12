const _ = require('lodash');
const Promise = require('bluebird');
const errors = require('../errors');
const Payment = require('../models/payment');
const Gateway = require('../models/gateway');
const view = require('../views/gateway');
const queueService = require('../services/queue_service');

module.exports = {
  getTokenizerKey: function getKey(req, res, next) {
    const gateway = req.context.gateway;

    gateway.getTokenizerKey().then((key) => {
      res.json(key);
    });
  },

  fetch: function fetch(req, res, next) {
    const type = req.params.id;
    const tenantId = req.context.tenantId;

    Gateway
      .forge({ type, tenant_id: tenantId })
      .fetch()
      .then((gateway) => {
        if (!gateway) {
          return next(new errors.NotFoundError());
        }

        req.context.gateway = gateway;
        return next();
      })
      .catch(next)
      .done();
  },

  getAll: function getAll(req, res, next) {
    req.context.tenant.related('gateways')
      .fetch()
      .then((gateways) => {
        return Promise.all(gateways.map(view));
      })
      .then((gatewayJsons) => {
        res.json(gatewayJsons);
      })
      .catch(next)
      .done();
  },

  returnView: function returnView(req, res, next) {
    view(req.context.gateway)
      .then((jsonView) => {
        res.json(jsonView);
      })
      .catch(next)
      .done();
  },

  parseIpn(req, res, next) {
    const gateway = req.context.gateway;

    req.log.debug('parse_ipn.raw_payload', { raw_payload: req.body });

    const promise = new Promise(((resolve, reject) => {
      if (!req.body || _.isEmpty(req.body)) {
        req.log.error('parse_ipn.no_payload');
        reject(new errors.BadRequest('Request body is empty'));
      } else {
        resolve();
      }
    }));

    promise.then(() => {
      return gateway.parseIpnPayload(req.body, req.query);
    })
      .then((ipnData) => {
        req.context.ipnData = ipnData;

        if (!req.context.ipnData || !_.every(req.context.ipnData, 'client_reference')) {
          req.log.error('parse_ipn.client_reference_not_found', { ipnData: req.context.ipnData });
          throw new errors.BadRequest('Could not extract client_reference from IPN');
        }

        next();
      })
      .catch((err) => {
        if (err.name === 'SkipIpnError') {
          req.log.info('parse_ipn.skiping_ipn');
          return gateway.ipnSuccessResponse(res);
        }

        return gateway.saveFailedIpn(req.body, null, err)
          .catch((ipnErr) => {
            req.log.error('parse_ipn.saving_failed_ipn.error_saving', {
              gateway_id: req.context.gateway.get('id'),
              payload: req.body,
              message: ipnErr.message || null,
            });
          })
          .then(() => {
            throw err;
          });
      })
      .catch((err) => {
        return gateway.ipnFailResponse(res, err, [], req.body);
      })
      .catch(next)
      .done();
  },

  processIpn: function ipn(req, res, next) {
    const gateway = req.context.gateway;
    const tenant = req.context.tenant;
    const ipns = req.context.ipnData;
    const notificationsResult = {};

    const notifications = _.map(ipns, (ipnData) => {
      const clientReference = ipnData.client_reference;
      const log = req.log.child({
        client_reference: ipnData.client_reference,
        tenant: tenant.get('name'),
        gateway: gateway.get('name'),
      });

      log.info('incoming_ipn', {
        payload: ipnData.payloadJson,
      });

      const processIpnPromise = Payment.forge({
        tenant_id: tenant.get('id'),
        client_reference: ipnData.client_reference,
      })
        .fetch({ withRelated: ['gatewayMethod'] })
        .then((p) => {
          if (!p) {
            throw new errors.BadRequest('Payment reference not found', {
              client_reference: ipnData.client_reference,
            });
          }
          return p;
        })
        .then((p) => {
          return gateway.processIpn(p, ipnData.payloadJson);
        });

      return processIpnPromise
        .catch((err) => {
          log.error('incoming_ipn.error_while_processing_ipn', {
            error: err,
          });

          throw err;
        })
        .then(() => {
          // Will execute the three following thing
          // ONLY if the processIpn was successful.
          // Else, it will only return the processIpn
          // rejection.

          processIpnPromise
            .then((result) => {
              log.info('incoming_ipn.processed_result', {
                propagate: result.propagate,
                payment_status: result.payment.get('status_id'),
              });
            })
            .catch(() => {
              // I can't do anything, but we catch so
              // we don't leave an uncatched promise
            });

          processIpnPromise
            .then((result) => {
              return gateway.saveIncomingIpn(ipnData.payloadJson, result.payment);
            })
            .catch((err) => {
              log.error('incoming_ipn.save_error', {
                err,
              });
            });

          return processIpnPromise
            .then((result) => {
              return queueService.paymentUpdated(result.payment)
                .tap(() => {
                  log.debug('incoming_ipn.saving_in_queue.payment_updated.success');
                })
                .catch((err) => {
                  log.error('incoming_ipn.saving_in_queue.payment_updated.failed', {
                    error: err,
                  });
                  throw err;
                });
            });
        })
        .then(() => {
          notificationsResult[clientReference] = null;
          return null;
        })
        .catch((err) => {
          notificationsResult[clientReference] = err;

          return gateway.saveFailedIpn(req.body, ipnData.client_reference, err)
            .catch((ipnErr) => {
              req.log.error('process_ipn.saving_failed_ipn.error_saving', {
                gateway_id: req.context.gateway.get('id'),
                payload: req.body,
                message: ipnErr.message || null,
              });
            })
            .then(() => {
              return err;
            });
        });
    });

    Promise.all(notifications)
      .then(() => {
        const failedResults = _.omit(notificationsResult, _.isNull);

        if (_.keys(failedResults).length >= 1) {
          req.log.warn('gateways.process_ipn.failed_results', {
            message: failedResults,
          });

          throw new errors.BadRequest('One or more ipns failed', {
            errors: _.mapValues(failedResults, e => e.message || e.code),
          });
        }
      })
      .then(() => { return gateway.ipnSuccessResponse(res); })
      .catch((err) => {
        const failedResults = _.omit(notificationsResult, _.isNull);
        const clientReferences = _.keys(failedResults);

        return gateway.ipnFailResponse(res, err, clientReferences, req.body);
      })
      .catch(next)
      .done();
  },
};
