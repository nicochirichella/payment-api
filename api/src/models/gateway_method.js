const _ = require('lodash');
const config = require('../config');
const BaseModel = require('./base_model.js');
const mixins = require('./gateway_methods/index');
const errors = require('../errors');
const log = require('../logger');
const util = require('util');
const url = require('url');
const PaymentStatuses = require('./constants/payment_status.js');
const GatewayMethodActionType = require('./constants/gateway_method_action_type.js');
const InterestRate = require('./interest_rate');
const Promise = require('bluebird');
const knex = require('../bookshelf').knex;
const Payment = require('./payment');
const moment = require('moment-business-time');
const GatewayMethodConfigs = require('./gateway_methods_config/index');

function getMixin(type) {
  const mixin = mixins[type];
  if (!mixin) {
    throw new Error(`Unsupported gateway method type: ${type}`);
  }
  return mixin;
}

function validatePaymentCreation(paymentData) {
  return this.validatePayment(paymentData)
    .then(() => this.validateInterest(paymentData))
    .catch((e) => {
      log.info('create_payment.validation.error', {
        error: e,
        client_reference: paymentData.clientReference,
        gateway_method: this.get('name'),
        gateway_method_id: this.get('id'),
        installments: paymentData.installments,
        amount: paymentData.amountInCents,
        interest: paymentData.interestInCents,
      });
      throw e;
    });
}

function createPayment(paymentData, opts) {
  return this.validatePaymentCreation(paymentData)
    .then(() => {
      paymentData.expiration_date = this.getExpirationDateOnCreation();
      return paymentData;
    })
    .then(pd => require('./payment').create(this, pd, opts));
}

function processPayment(payment, paymentData) {
  return this.getNotificationUrl().then((notificationUrl) => {
    return knex.transaction((t) => {
      return Payment
        .query((qb) => {
          return qb
            .transacting(t)
            .forUpdate()
            .where('id', payment.get('id'));
        })
        .fetch()
        .then(() => {
          return this.gateway.sendPayment(payment, paymentData, { notificationUrl })
            .then((resp) => {
              payment.set('payment_information', resp.paymentInformation);
              payment.set('status_id', resp.paymentStatus);
              payment.set('gateway_reference', resp.gatewayReference);
              payment.set('status_detail', resp.statusDetail);
              payment.set('metadata', resp.metadata);

              return payment.save(null, { transacting: t })
                .then(() => {
                  let returnUrl = null;
                  if (this.gatewayMethodActionType === GatewayMethodActionType.redirect) {
                    returnUrl = resp.redirectUrl;
                  }

                  const outResponse = {
                    external_reference: resp.gatewayReference,
                    client_reference: payment.get('client_reference'),
                    status_id: resp.paymentStatus,
                    redirect_url: returnUrl,
                    gateway_method_action_type: this.gatewayMethodActionType,
                    should_retry: resp.shouldRetry,
                  };

                  log.debug('process_payment.outgoing_response', { body: outResponse });

                  return outResponse;
                });
            });
        });
    });
  }).catch((err) => {
    payment.set('status_id', PaymentStatuses.error);
    return payment.save().then(() => {
      throw err;
    });
  }).tap(() => {
    return payment.refresh().then((updatedPayment) => {
      return this.postSendAction(updatedPayment);
    });
  });
}

function postSendAction(payment) {
  return Promise.resolve();
}


function getExpirationDateOnCreation() {
  const ttl = this.get('pre_execute_ttl') ? this.get('pre_execute_ttl') : this.get('post_execute_ttl');
  return this.calculateExpirationDate(moment().utc(), ttl);
}

function getExpirationDateAfterExecute(payment) {
  return this.calculateExpirationDate(moment(payment.get('expiration_date')).utc(), this.get('post_execute_ttl'));
}


function calculateExpirationDate(startDate, ttl) {
  if (this.get('payment_ttl_include_weekends')) {
    return startDate.add(ttl, 'minutes');
  }
  return startDate.addWorkingTime(ttl, 'minutes');
}

function getNotificationUrl() {
  return this.getRelation('tenant')
    .then((tenant) => {
      return url.resolve(
        config.get('baseUrl'),
        util.format(
          '/%s/v1/gateways/%s/ipn',
          tenant.get('name'),
          this.gateway.get('type'),
        ),
      );
    });
}

function convertInterest(interestRates) {
  return _.chain(interestRates.toArray())
    .map(i => ({
      installments: i.get('amount'),
      interestPercentage: i.get('interest'),
    }))
    .sortBy('installments')
    .value();
}

function getConfig() {
  return new Promise(resolve => resolve(GatewayMethodConfigs[this.get('type').toLowerCase()]))
    .catch(() => {
      throw new errors.NotFoundError('Gateway config not found');
    })
    .then((provider) => {
      return this.getRelation('interestRates')
        .then(interestRates => convertInterest(interestRates))
        .then(installments => provider.getData(installments));
    });
}

function validateInterest(paymentData) {
  const installments = paymentData.installments;
  const amount = paymentData.amountInCents;
  return InterestRate
    .forge()
    .where({ amount: installments, gateway_method_id: this.get('id') })
    .fetch()
    .then((interestRate) => {
      if (!interestRate) {
        return Promise.reject(new errors.InvalidAmountOfInstallments(installments, this.get('name')));
      }
      const rate = interestRate.get('interest');
      const interest = Math.round((amount * rate) / 100);
      if (Math.abs(interest - Number(paymentData.interestInCents || 0)) > 1) {
        const err = new errors.InterestMismatchError(interest, paymentData.interestInCents);
        return Promise.reject(err);
      }
      return Promise.resolve();
    });
}

module.exports = BaseModel.extend({
  tableName: 'gateway_methods',

  validations: {
    tenant_id: ['required', 'naturalNonZero'],
    name: ['required', 'minLength:1', 'maxLength:255'],
    type: ['required', 'minLength:1', 'maxLength:255'],
    enabled: ['required', 'boolean'],
    ui_url: ['url', 'maxLength:255'],
    payment_method_id: ['required', 'naturalNonZero'],
  },

  initialize(...args) {
    BaseModel.prototype.initialize.apply(this, args);
    const self = this;

    this.once('fetched', () => {
      const mixin = getMixin(self.get('type'));
      _.extend(self, mixin);

      return require('./gateway')
        .forge({ type: mixin.gatewayType, tenant_id: self.get('tenant_id') })
        .fetch()
        .then((gateway) => {
          self.gateway = gateway;
        });
    });
  },

  getSetting(name) {
    return this.get('settings') && this.get('settings')[name];
  },

  payments() {
    return this.hasMany(require('./payment'));
  },

  paymentMethod() {
    return this.belongsTo(require('./payment_method'));
  },

  tenant() {
    return this.belongsTo(require('./tenant'));
  },

  interestRates() {
    return this.hasMany(require('./interest_rate'));
  },

  paymentMethods() {
    return this.belongsToMany(require('./payment_method'))
  },

  cancelPayment() {
    throw new Error('Not implemented');
  },

  chargeBackPayment() {
    throw new Error('Not implemented');
  },

  executePayment() {
    throw new Error('Not implemented');
  },

  capturePayment() {
    throw new Error('Not implemented');
  },

  createRejection() {
    throw new Error('Not implemented');
  },

  cancelManualRevisionPayment() {
    throw new Error('Not implemented');
  },

  postIpnProcessAction() {
    return Promise.resolve();
  },

  validatePaymentCreation,

  createPayment,

  processPayment,

  saveIpnResult: function saveIpnResult(payment, ipnData) {
    const status = ipnData.status;
    const statusDetail = ipnData.statusDetail;

    if (payment.shouldIgnoreTransitionTo(status)) {
      log.info('process_ipn.ignored_transition', {
        client_reference: payment.get('client_reference'),
        payment_id: payment.get('id'),
        from_status: payment.get('status_id'),
        to_status: status,
      });
      return Promise.reject(new errors.SkipIpnError('Ignored Transition'));
    }

    return knex.transaction((t) => {
      return Payment.query((qb) => {
        return qb
          .transacting(t)
          .forUpdate()
          .where('id', payment.get('id'))
          .select('id');
      }).fetch()
        .then(() => {
          return payment.refresh({ transacting: t })
            .then(() => {
              if (payment.get('status_id') === status) {
                log.info('process_ipn.same_status_transition', {
                  client_reference: payment.get('client_reference'),
                  payment_id: payment.get('id'),
                  status,
                });
              } else {
                if (!payment.canTransitionTo(status)) {
                  log.error('process_ipn.invalid_transition', {
                    client_reference: payment.get('client_reference'),
                    payment_id: payment.get('id'),
                    from_status: payment.get('status_id'),
                    to_status: status,
                  });
                }
                payment.set('status_id', status);
                payment.set('status_detail', statusDetail);
              }

              return payment
                .save(null, { transacting: t })
                .return({
                  payment,
                  propagate: true,
                });
            });
        });
    });
  },

  getExpirationDateOnCreation,
  calculateExpirationDate,
  getConfig,
  validateInterest,
  getNotificationUrl,
  getExpirationDateAfterExecute,
  postSendAction,
});

