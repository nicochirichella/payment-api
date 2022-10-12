const _ = require('lodash');
const BaseModel = require('./base_model.js');
const Promise = require('bluebird');
const PaymentStatus = require('./constants/payment_status');
const errors = require('../errors');
const log = require('../logger');
const Transitionable = require('./mixins/transitionable');
const queueService = require('../services/queue_service');

function transformData(paymentMethod, data) {
  const interest = _.sum(data.payments, 'interestInCents') / 100;
  const formatted = {
    purchase_reference: data.purchaseReference,
    reference: data.reference,
    currency: data.currency,
    payment_method_id: paymentMethod ? paymentMethod.id : undefined,
    tenant_id: paymentMethod ? paymentMethod.get('tenant_id') : undefined,
    total: data.shoppingCart ? (data.shoppingCart.totalCostInCents / 100) + interest : undefined,
    interest,
    metadata: data.metadata,
  };

  return _.omit(formatted, undefined);
}


function validatePrice(data) {
  const itemsTotal = _.sum(data.shoppingCart.items, 'totalCostInCents');
  const shoppingCartTotal = data.shoppingCart.totalCostInCents;
  const paymentsTotal = _.sum(data.payments, 'amountInCents');

  if ((itemsTotal === shoppingCartTotal) && (itemsTotal === paymentsTotal)) {
    return Promise.resolve();
  }
  return Promise.reject(new errors.PriceMismatchError(paymentsTotal, shoppingCartTotal));
}


function doCreate(data, paymentMethod) {
  return BaseModel.transaction((t) => {
    const buyerInfo = require('./buyer').parse(data.buyer, { transacting: t });
    const paymentOrder = PaymentOrder.forge(PaymentOrder.parse(paymentMethod, data)); // eslint-disable-line
    paymentOrder.relations.paymentMethod = paymentMethod;

    return paymentOrder.related('buyer').save(buyerInfo, { transacting: t })
      .then((buyer) => {
        return paymentOrder.save({
          status_id: PaymentStatus.creating,
          buyer_id: buyer.id,
        }, { transacting: t });
      })
      .then((po) => {
        let items = require('./item').parse(data.shoppingCart.items);
        const itemCollection = po.related('items');

        items = _.map(items, item => itemCollection.create(item, { transacting: t }));

        return Promise.all(items);
      })
      .then(() => paymentMethod.validatePaymentsCreation(data.payments, paymentOrder.get('id')))
      .then(() => paymentOrder)
      .then(t.commit)
      .catch(t.rollback);
  });
}

const PaymentOrder = BaseModel.extend({
  tableName: 'payment_orders',

  validations: {
    currency: ['required', 'exactLength:3', 'alpha'],
    purchase_reference: ['maxLength:150'],
    reference: ['required', 'maxLength:150'],
    payment_method_id: ['required', 'naturalNonZero'],
    buyer_id: ['required', 'naturalNonZero'],
    tenant_id: ['required', 'naturalNonZero'],
    status_id: ['required', _.partial(_.contains, _.values(PaymentStatus))],
    total: ['required', 'numeric'],
    interest: ['required', 'numeric'],
  },

  paymentMethod() {
    return this.belongsTo(require('./payment_method'));
  },

  payments() {
    return this.hasMany(require('./payment'));
  },

  validPayments() {
    return this.hasMany(require('./payment'))
      .query((qb) => {
        qb.whereNull('retried_with_payment_id');
      });
  },

  buyer() {
    return this.belongsTo(require('./buyer'));
  },

  items() {
    return this.hasMany(require('./item'));
  },

  statusName() {
    return this.get('status_id').toString();
  },

  tenant() {
    return this.belongsTo(require('./tenant'));
  },

  updateStatus() {
    const self = this;

    return this.getRelation('paymentMethod')
      .then((pm) => {
        return pm.calculateStatus(self);
      })
      .then((status) => {
        const oldStatus = self.get('status_id');

        if (oldStatus === status) {
          log.info('payment_order.update_status.same_status_transition', {
            reference: self.get('reference'),
            payment_order_id: self.get('id'),
            status,
          });
        } else {
          if (!self.canTransitionTo(status)) {
            log.error('payment_order.update_status.invalid_transition', {
              reference: self.get('reference'),
              payment_order_id: self.get('id'),
              from_status: oldStatus,
              to_status: status,
            });
          } else {
            log.debug('payment_order.update_status.transitioning', {
              reference: self.get('reference'),
              payment_order_id: self.get('id'),
              from_status: oldStatus,
              to_status: status,
            });
          }

          self.set('status_id', status);
        }

        return self.save()
          .then(() => {
            return {
              newStatus: status,
              oldStatus,
            };
          });
      });
  },

  capture() {
    return this.transitionTo(PaymentStatus.pendingCapture, () => {
      return this.getRelation('validPayments')
        .then((payments) => {
          const capturePromises = payments.map((p) => {
            const paymentLog = log.child({
              client_reference: p.get('client_reference'),
              reference: this.get('refrence'),
            });

            return require('../services/queue_service').capturePayment(p)
              .tap(() => paymentLog.debug('payment_order.capture.capture_payment_event.send_success'))
              .catch((err) => {
                paymentLog.warn('payment_order.capture.capture_payment_event.send_failed', {
                  err,
                });

                throw err;
              });
          });

          return Promise.all(capturePromises);
        });
    });
  },

  history() {
    return BaseModel.bookshelf.knex
      .pluck('status_id')
      .from('payment_order_status_history')
      .where({
        payment_order_id: this.get('id'),
      })
      .orderBy('date', 'asc');
  },

  chargeBack() {
    return this.transitionTo(
      PaymentStatus.chargedBack,
      () => this.getRelation('paymentMethod')
        .then(pm => pm.chargeBackPaymentOrder(this)),
    );
  },

  cancel() {
    return this.transitionTo(
      PaymentStatus.pendingCancel,
      () => this.getRelation('paymentMethod')
        .then(pm => pm.cancelPaymentOrder(this))
        .then(() => this.updateStatus()),
    );
  },

  execute(metadata) {
    return this.transitionTo(
      PaymentStatus.pendingExecute,
      () => this.getRelation('paymentMethod')
        .then(pm => pm.executePaymentOrder(this, metadata))
        .then(() => this.updateStatus()),
    );
  },

  notifyToTenant: async function notifyToTenant() {
    const payments = await this.getRelation('validPayments');
    const isSynchronicArray = await Promise.all(payments.map((p) =>
      p.getRelation('gatewayMethod')
        .then((gm) => gm.get('syncronic_notify_on_creation'))
    ));
    const shouldNotify = _.any(isSynchronicArray, _.identity);

    if (shouldNotify) {
      return queueService.sendIpn(this);
    }
    else {
      return Promise.resolve();
    }
  },

  manualRefund() {
    return this.transitionTo(
      PaymentStatus.refunded,
      () => this.getRelation('paymentMethod')
        .then(pm => pm.manualRefundPaymentOrder(this)),
    );
  },

  getExpirationDate() {
    return this.getRelation('validPayments')
      .then((payments) => {
        const atLeastOneNullExpirationDate = payments.any((p) => {
          return p.get('expiration_date') === null;
        });

        if (atLeastOneNullExpirationDate) {
          return null;
        }
        const dates = payments.map(p => Date.parse(p.get('expiration_date')));
        return _.max(dates);
      });
  },

  getExecuteRedirectUrl() {
    const metadata = this.get('metadata');
    let redirectUrl = metadata.pendingUrl;

    switch (this.get('status_id')) {
      case PaymentStatus.successful: {
        redirectUrl = metadata.successUrl;
        break;
      }
      case PaymentStatus.rejected: {
        redirectUrl = metadata.cancelUrl;
        break;
      }
      default:
        break;
    }

    return redirectUrl;
  },

}, {
  create(paymentMethod, data) {
    log.debug('payment_order.create', {
      purchase_reference: data.purchaseReference,
      reference: data.reference,
    });

    return validatePrice(data)
      .then(() => doCreate(data, paymentMethod));
  },

  parse(paymentMethod, data) {
    return transformData(paymentMethod, data);
  },
});

PaymentOrder.prototype = _.extend(PaymentOrder.prototype, Transitionable.prototype);

module.exports = PaymentOrder;
