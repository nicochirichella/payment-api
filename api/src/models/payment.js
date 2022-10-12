const _ = require('lodash');
const BaseModel = require('./base_model.js');
const log = require('../logger');
const PaymentStatus = require('./constants/payment_status');
const PaymentStatusDetail = require('./constants/payment_status_detail');
const PaymentType = require('./constants/payment_type');
const Transitionable = require('./mixins/transitionable');
const queueService = require('../services/queue_service');

function transformData(gatewayMethod, data) {
  return {
    payment_order_id: data.paymentOrderId,
    client_reference: data.clientReference,
    gateway_reference: data.gatewayReference,
    installments: data.installments,
    currency: data.currency,
    payment_information: data.paymentInformation,
    gateway_method_id: gatewayMethod.get('id'),
    type: data.type,
    amount: data.amountInCents ? data.amountInCents / 100 : undefined,
    interest: data.interestInCents ? data.interestInCents / 100 : 0,
    tenant_id: gatewayMethod.get('tenant_id'),
    expiration_date: data.expiration_date,
  };
}

const Payment = BaseModel.extend({
  tableName: 'payments',

  validations: {
    installments: ['natural'],
    currency: ['required', 'exactLength:3', 'alpha'],
    gateway_reference: ['maxLength:150'],
    client_reference: ['required', 'maxLength:150'],
    gateway_method_id: ['required', 'naturalNonZero'],
    status_id: ['required', _.partial(_.contains, _.values(PaymentStatus))],
    status_detail: [_.partial(_.contains, _.values(PaymentStatusDetail))],
    amount: ['required', 'numeric'],
    type: ['required', _.partial(_.contains, _.values(PaymentType))],
    interest: ['required', 'numeric'],
    tenant_id: ['required', 'naturalNonZero'],
    expiration_date: ['required'],
  },

  virtuals: {
    total: {
      get() {
        const amount = this.get('amount') * 1;
        const interest = this.get('interest') * 1;

        return Math.round((amount + interest) * 100) / 100;
      },
    },
  },

  paymentOrder() {
    return this.belongsTo(require('./payment_order'));
  },

  gatewayMethod() {
    return this.belongsTo(require('./gateway_method'));
  },

  history() {
    return BaseModel.bookshelf.knex
      .pluck('status_id')
      .from('payment_status_history')
      .where({
        payment_id: this.get('id'),
      })
      .orderBy('date', 'asc');
  },

  statusName() {
    return this.get('status_id').toString();
  },

  chargeBack() {
    return this.transitionTo(
      PaymentStatus.chargedBack,
      () => this
        .gatewayMethod()
        .fetch()
        .then(gm => gm.chargeBackPayment(this)),
    );
  },

  cancel() {
    return this.transitionTo(
      PaymentStatus.pendingCancel,
      () => this.getRelation('gatewayMethod')
        .then(gm => gm.cancelPayment(this)),
    );
  },

  execute(metadata) {
    return this.transitionTo(
      PaymentStatus.pendingExecute,
      () => this.getRelation('gatewayMethod')
        .then((gm) => {
          return gm.executePayment(this, metadata)
            .then(() => {
              return gm.getExpirationDateAfterExecute(this);
            }).then((newExpirationDate) => {
              return this.set('expiration_date', newExpirationDate).save();
            });
        }),
    );
  },

  capture() {
    return this.getRelation('gatewayMethod').then((gm) => {
      return this.transitionTo(
        PaymentStatus.pendingCapture,
        () => gm.capturePayment(this),
      ).then((payment) => {
        if (gm.get('syncronic_capture')) {
          this.set('status_id', PaymentStatus.successful);
          return this.save().then(() => {
            return this.getRelation('paymentOrder')
              .then((po) => po.updateStatus()
                .then(() => queueService.sendIpn(po))
              )
          });
        }
        return payment;
      });
    });
  },

  setManualMetadata() {
    const newMetadata = this.get('metadata');
    newMetadata.manualRefunded = true;
    return this.set('metadata', newMetadata).save();
  },

  manualRefunded() {
    return this.transitionTo(
      PaymentStatus.refunded,
      () => this
        .setManualMetadata(),
    );
  },

  rejection(reason) {
    return this.getRelation('gatewayMethod').then((gm) => {
      return gm.createRejection(this, reason);
    });
  },

  hasRejections() {
    return (
      this.has('metadata') &&
            (this.get('metadata').rejections) !== null &&
            (this.get('metadata').rejections) !== undefined &&
            this.get('metadata').rejections.length > 0);
  },

  isValid() {
    return this.get('retried_with_payment_id') === null;
  }

}, {
  create(gatewayMethod, data, opts) {
    const payment = this.forge(this.parse(gatewayMethod, data));
    payment.relations.gatewayMethod = gatewayMethod;

    return payment.save({
      status_detail: PaymentStatusDetail.creating,
      status_id: PaymentStatus.creating,
    }, opts);
  },

  parse(gatewayMethod, data) {
    return transformData(gatewayMethod, data);
  },
});

Payment.prototype = _.extend(Payment.prototype, Transitionable.prototype);

module.exports = Payment;
