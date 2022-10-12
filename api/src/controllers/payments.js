const paymentView = require('../views/payments');
const Payment = require('../models/payment');
const errors = require('../errors');

module.exports = {

  validateWithPaymentOrder(req, res, next) {
    const payment = req.context.payment;
    const paymentOrder = req.context.paymentOrder;

    if (!paymentOrder) {
      next(new errors.NotFoundError('Payment Order was not found'));
    }

    if (!payment) {
      next(new errors.NotFoundError('Payment was not found'));
    }

    if (payment.get('payment_order_id') !== paymentOrder.get('id')) {
      next(new errors.NotFoundError('Payment does not correspond to paymentOrder'));
    }
    next();
  },

  fetch(req, res, next) {
    const tenant = req.context.tenant;
    const clientReference = req.body.clientReference;

    Payment
      .forge({ client_reference: clientReference, tenant_id: tenant.get('id') })
      .fetch({ withRelated: ['gatewayMethod'] })
      .then((p) => {
        if (!p) {
          return next(new errors.NotFoundError('Payment not found', {
            clientReference,
            tenant: tenant.get('name'),
          }));
        }

        req.context.payment = p;
        return next();
      })
      .catch(next)
      .done();
  },

  view(req, res, next) {
    const p = req.context.payment;
    paymentView(p)
      .then((view) => {
        res.json(view);
      })
      .catch(next)
      .done();
  },

  rejection(req, res, next) {
    const p = req.context.payment;
    p.rejection(req.body.reason)
      .then(() => {
        res.send();
      })
      .catch((err) => {
        if (err.name === 'NoMatchingStatusError') {
          next(new errors.BadRequest());
        }

        if (err.name === 'InvalidActionForCurrentPaymentStatus') {
          next(new errors.BadRequest());
        }

        next(err);
      })
      .done();
  },

};
