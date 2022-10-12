const _ = require('lodash');
const errors = require('../errors');
const PaymentMethod = require('../models/payment_method');
const PaymentOrder = require('../models/payment_order');
const paymentRequestResponseView = require('../views/payment_request_response');
const paymentOrderView = require('../views/payment_order');
const executeResponseView = require('../views/execute_response');
const helpers = require('../lib/helpers');
const Transitionable = require('../models/mixins/transitionable');
const PaymentStatus = require('../models/constants/payment_status');
const queueService = require('../services/queue_service');

function processPaymentData(paymentOrderData) {
  let i = 0;
  return _.zipObject(_.map(paymentOrderData.payments, (payment) => {
    i += 1;

    payment.currency = paymentOrderData.currency;
    payment.clientReference = `${paymentOrderData.reference}_${i}_1`;

    return [payment.clientReference, payment];
  }));
}

function isSafeInvalidStateChangeError(toState, err) {
  const unsafeTransitionsFromStatuses = Transitionable.unsafeInvalidTransitionsToStatus[toState];
  return err.name === 'InvalidStateChangeError' &&
    !_.contains(unsafeTransitionsFromStatuses, err.context.fromState);
}


function logError(err, log, toStatus, baseLog) {
  if (isSafeInvalidStateChangeError(toStatus, err)) {
    log.debug(`${baseLog}invalid_status_change`, {
      from_state: err.context.fromState,
    });
  } else {
    log.error(`${baseLog}error`, {
      error: err,
    });
  }
}

module.exports = {
  createPaymentOrder(req, res, next) {
    const payload = req.body;
    const methodType = payload.paymentOrder.paymentMethod;
    const tenant = req.context.tenant;

    req.log.debug('create_payment.starting', {
      tenant_id: tenant.get('id'),
      body: helpers.maskCreatePaymentRequest(payload),
    });

    PaymentMethod
      .forge({ type: methodType, tenant_id: tenant.id })
      .fetch()
      .then((pm) => {
        if (!pm || !pm.get('enabled')) {
          return next(new errors.BadRequest('Unsupported Payment Method', {
            methodType,
            tenant: tenant.get('name'),
          }));
        }

        payload.paymentOrder.payments = processPaymentData(payload.paymentOrder);
        req.log.debug('process_payment_data', { payments: helpers.maskPayments(payload.paymentOrder.payments) });
        return PaymentOrder.create(pm, payload.paymentOrder)
          .tap((po) => {
            req.log.debug('create_payment_order.created', {
              reference: po.get('reference'),
            });
          })
          .catch((e) => {
            req.log.info('create_payment_order.error', {
              error: e,
            });

            throw e;
          })
          .then(po => pm.processPaymentOrder(po, payload.paymentOrder.payments)
            .then((result) => {
              req.log.debug('process_payment_order.success', {
                reference: po.get('reference'),
              });

              result.paymentOrder = po;
              return paymentRequestResponseView(result)
                .then(jsonView => res.json(jsonView));
            })
            .tap(() => po.notifyToTenant())
            .catch((e) => {
              req.log.info('process_payment_order.error', {
                error: e,
              });

              throw e;
            }));
      })
      .catch((e) => {
        req.log.error('payment_order_creation_request.error', {
          error: e,
        });

        throw e;
      })
      .catch(next)
      .done();
  },

  fetch(req, res, next) {
    const tenant = req.context.tenant;
    const paymentReference = req.params.paymentReference;

    PaymentOrder
      .forge({ reference: paymentReference, tenant_id: tenant.get('id') })
      .fetch({ withRelated: ['paymentMethod', 'payments'] })
      .then((po) => {
        if (!po) {
          return next(new errors.NotFoundError('Payment not found', {
            paymentReference,
            tenant: tenant.get('name'),
          }));
        }

        req.context.paymentOrder = po;
        return next();
      })
      .catch(next)
      .done();
  },

  view(req, res, next) {
    const po = req.context.paymentOrder;
    paymentOrderView(po)
      .then((view) => {
        res.json(view);
      })
      .catch(next)
      .done();
  },

  chargeBack(req, res, next) {
    const log = req.log.child({
      tenant: req.context.tenant.id,
      payment_order_id: req.context.paymentOrder.id,
      reference: req.context.paymentOrder.get('reference'),
    });

    log.debug('charge_back_payment_order.starting');

    req.context.paymentOrder
      .chargeBack()
      .then(() => {
        log.debug('charge_back_payment_order.success');
        return res.send();
      })
      .catch((err) => {
        logError(err, log, PaymentStatus.chargedBack, 'charge_back_payment_order.');
        next(err);
      })
      .done();
  },

  cancel(req, res, next) {
    const log = req.log.child({
      tenant: req.context.tenant.id,
      payment_order_id: req.context.paymentOrder.id,
      reference: req.context.paymentOrder.get('reference'),
    });

    log.debug('cancel_payment_order.starting');

    req.context.paymentOrder
      .cancel()
      .then(() => {
        log.debug('cancel_payment_order.success');
        return res.send();
      })
      .then(() => {
        return queueService.sendIpn(req.context.paymentOrder)
          .catch((error) => {
            log.error('cancel_payment_order.send_ipn_error', {
              error,
            });
          });
      })
      .catch((err) => {
        logError(err, log, PaymentStatus.cancelled, 'cancel_payment_order.');
        next(err);
      })
      .done();
  },

  execute(req, res, next) {
    const metadata = req.body;

    const log = req.log.child({
      tenant: req.context.tenant.id,
      payment_order_id: req.context.paymentOrder.id,
      reference: req.context.paymentOrder.get('reference'),
      metadata,
    });

    log.debug('execute_payment_order.starting');

    req.context.paymentOrder
      .execute(metadata)
      .tap(() => {
        log.debug('execute_payment_order.success');
      })
      .catch((err) => {
        log.debug('execute_payment_order.saved_error', { error: err });
      })
      .then(() => {
        return executeResponseView(req.context.paymentOrder)
          .then(jsonView => res.json(jsonView));
      })
      .then(() => {
        return queueService.sendIpn(req.context.paymentOrder)
          .catch((error) => {
            log.error('execute_payment_order.send_ipn_error', {
              error,
            });
          });
      })
      .catch((err) => {
        logError(err, log, PaymentStatus.pendingExecute, 'execute_payment_order.');
        next(err);
      })
      .done();
  },

  manualRefunded(req, res, next) {
    const log = req.log.child({
      tenant: req.context.tenant.id,
      payment_order_id: req.context.paymentOrder.id,
      reference: req.context.paymentOrder.get('reference'),
    });

    log.debug('manual_refunded_payment_order.starting');

    req.context.paymentOrder
      .manualRefund()
      .then(() => {
        log.debug('manual_refunded_payment_order.success');
        return res.send();
      })
      .catch((err) => {
        logError(err, log, PaymentStatus.refunded, 'manual_refunded_payment_order.');
        next(err);
      })
      .done();
  },

  processPaymentData
};
