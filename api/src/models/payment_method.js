const _ = require('lodash');
const BaseModel = require('./base_model.js');
const mixins = require('./payment_methods/index');
const Promise = require('bluebird');
const PaymentStatus = require('./constants/payment_status');
const Payment = require('./payment.js')
const GatewayMethodActionType = require('./constants/gateway_method_action_type.js');
const PaymentMethodGatewayMethod = require('../models/payment_method_gateway_method');
const Transitionable = require('./mixins/transitionable');
const logger = require('../logger');
const helper = require('../lib/helpers');
const EncryptionTypeToGatewayMethodMapper = require('../mappers/encryption_type_to_gateway_method_mapper');
const errors = require('../errors');

function getMixin(type) {
  const mixin = mixins[type];
  if (!mixin) {
    throw new Error(`Unsupported payment method type: ${type}`);
  }
  return mixin;
}

function paymentIterator(paymentOrder, baseLog, nonSkipableStatuses, iterator) {
  const log = logger.child({
    reference: paymentOrder.get('reference'),
  });

  log.debug(`${baseLog}.start`);

  return paymentOrder.getRelation('validPayments')
    .then((payments) => {
      return helper.promiseSettleFirst(payments.toArray(), (payment) => {
        return iterator(payment)
          .catch((err) => {
            if (err.name === 'InvalidStateChangeError' && !_.contains(nonSkipableStatuses, err.context.fromState)) {
              // We can skip this errors because the payment is in a status that
              // we are able to assure that it will not mess up with the payment order status.
              // The payment may be already refunded or marked as charge back, so it's safe to skip
              // this error, and make like the payment processed it.

              log.info(`${baseLog}.skip_payment.invalid_status_transition`, {
                payment_id: payment.get('id'),
                client_reference: payment.get('client_reference'),
                errorContext: err.context,
              });
              return;
            }
            log.info(`${baseLog}.payment_operation.error`, {
              error: err,
              payment_id: payment.get('id'),
              client_reference: payment.get('client_reference'),
            });

            throw err;
          });
      });
    })
    .tap(() => log.debug(`${baseLog}.success`))
    .catch((err) => {
      log.info(`${baseLog}.error`, { error: err });
      throw err;
    });
}

module.exports = BaseModel.extend({
  tableName: 'payment_methods',

  validations: {
    tenant_id: ['required', 'naturalNonZero'],
    gateway_method_id: ['naturalNonZero'],
    name: ['required', 'minLength:1', 'maxLength:255'],
    type: ['required', 'minLength:1', 'maxLength:255'],
    enabled: ['required'],
    ui_url: ['url', 'maxLength:255'],
  },

  initialize(args) {
    BaseModel.prototype.initialize.apply(this, args);

    this.once('fetched', () => {
      const mixin = getMixin(this.get('type'));
      _.extend(this, mixin);
    });
  },

  tenant() {
    return this.belongsTo(require('./tenant'));
  },

  getSetting(name) {
    return this.get('settings') && this.get('settings')[name];
  },

  getUiUrl() {
    return this.getRelation('gatewayMethod')
      .then(gm => gm.get('ui_url'));
  },

  payments() {
    return this.hasMany(require('./payment'));
  },

  validGatewayMethods() {
    return this.hasMany(require('./gateway_method'));
  },

  gatewayMethod() {
    return this.belongsTo(require('./gateway_method'));
  },

  paymentMethodGatewayMethods() {
    return this.hasMany(require('./payment_method_gateway_method'))
      .orderBy('gateway_method_order','asc');
  },

  orderedGatewayMethods: function orderedGatewayMethods() {
    return this.belongsToMany(require('./gateway_method'), 'payment_method_gateway_methods')
      .query((qb) => {
        qb.whereNull('payment_method_gateway_methods.deleted_at');
      })
      .orderBy('payment_method_gateway_methods.gateway_method_order','asc');
  },

  buildProcessResponse: function buildProcessResponse(paymentResponses, paymentOrder) {
    const atLeastOneRedirectPayment = _.map(paymentResponses, 'gateway_method_action_type')
      .some((type) => {
        return (type === GatewayMethodActionType.redirect);
      });

    if (atLeastOneRedirectPayment) {
      // Redirect returnUrl from first payment for now.
      // In the future, if we have multiple 'redirect' payments we should
      // generate a URL to our own frontend containing all the redirect
      // urls as query params.
      return {
        action: {
          type: 'redirect',
          data: {
            paymentOrderStatus: paymentOrder.get('status_id'),
            reference: paymentOrder.get('reference'),
            purchaseReference: paymentOrder.get('purchase_reference'),
            redirectUrl: _.first(paymentResponses, (pr) => {
              return (pr.gateway_method_action_type === GatewayMethodActionType.redirect);
            }).redirect_url,
          },
        },
      };
    }
    return {
      action: {
        type: 'status',
        data: {
          paymentOrderStatus: paymentOrder.get('status_id'),
          reference: paymentOrder.get('reference'),
          purchaseReference: paymentOrder.get('purchase_reference'),
        },
      },
    };
  },

  selectGatewayMethod: function selectGatewayMethod(paymentData) {
    return this.selectGatewayMethods(paymentData)
      .then((gatewayMethdos) => {
        return gatewayMethdos[0];
      })
      .catch((e) => {
        const errorCode = 'payment_methods.select_gateway_method.' + e.name;
        logger.info(errorCode, {
          payment_method_id: this.id,
          payment_data: paymentData,
          error: e,
        });
        throw e;
      });
  },

  getGivenByClientGatewayMethods: function getGivenByClientGatewayMethods(paymentData) {
    return [];
  },

  filterListByGatewayMethodTypes: function filterListByGatewayMethodTypes(gmList, gmTypes) {
    return gmList.filter(gm => gmTypes.includes(gm.get('type')));
  },

  selectGatewayMethods: async function selectGatewayMethods(paymentData) {
    const gatewayMethodTypes = this.getGivenByClientGatewayMethods(paymentData);
    const orderedGatewayMethods = await this.getRelation('orderedGatewayMethods')
      .then((gms) => { return gms.toArray(); });

    if (orderedGatewayMethods.length === 0) {
      throw new errors.PaymentMethodWithoutConfiguredGatewayMethod();
    }

    if (gatewayMethodTypes.length === 0) {
      return orderedGatewayMethods;
    }

    const filteredOrderedGatewayMethods = this.filterListByGatewayMethodTypes(orderedGatewayMethods,gatewayMethodTypes);
    if (filteredOrderedGatewayMethods.length > 0) {
      return filteredOrderedGatewayMethods;
    }

    const validGatewayMethdos = await this.getRelation('validGatewayMethods');
    const filteredValidGatewayMethods = this.filterListByGatewayMethodTypes(validGatewayMethdos,gatewayMethodTypes);
    if (filteredValidGatewayMethods.length > 0) {
      return filteredValidGatewayMethods;
    }

    throw new errors.InvalidEncryptionTypes();
  },

  updateClientReference: function updateClientReference(clientReference, attempt) {
    const index = clientReference.lastIndexOf('_');
    clientReference = clientReference.substr(0, index + 1) + attempt;
    return clientReference;
  },

  processPaymentWithRetries: async function processPaymentWithRetries(gatewayMethods, paymentData, paymentOrder, previousPayment, attempt = 0) {
    const lastAttempt = gatewayMethods.length;
    try {
      const gm = gatewayMethods[attempt];
      attempt++;

      paymentData.clientReference = this.updateClientReference(paymentData.clientReference, attempt);
      paymentData.paymentOrderId = paymentOrder.id;

      const newPayment = await this.createOrRetryPayment(gm, paymentData, previousPayment);
      const response = await gm.processPayment(newPayment, paymentData);

      if (!response.should_retry || attempt === lastAttempt) {
        return null;
      }

      return this.processPaymentWithRetries(gatewayMethods, paymentData, paymentOrder, newPayment, attempt);
    } catch (e) {
      logger.error('payment_method.process_payment_with_retries.error', {
        client_reference: paymentData.clientReference,
        error: e,
      });
      return this.setLastValidPayment(previousPayment);
    }
  },

  setLastValidPayment: async function setLastValidPayment(previousValidPayment) {
    if (!previousValidPayment) throw new Error('there is no previous valid payment');

    if (previousValidPayment.isValid()) return null;

    return Payment.forge({ id: previousValidPayment.get('retried_with_payment_id') })
      .fetch()
      .then((actualValidPayment) => {
        return BaseModel.transaction((t) => {
          actualValidPayment.set('retried_with_payment_id', previousValidPayment.get('id'));
          previousValidPayment.set('retried_with_payment_id', null);

          return Promise.all([actualValidPayment.save(null, { transacting: t }),
            previousValidPayment.save(null, { transacting: t })])
            .then(() => null)
            .then(t.commit)
            .catch(t.rollback);
        });
      });
  },

  createOrRetryPayment: async function createOrRetryPayment(gatewayMethod, paymentData, previousPayment) {
    logger.debug('payment_method.process_payment_with_retries.starting_to_create_payment', {
      client_reference: paymentData.clientReference,
      gateway_method_id: gatewayMethod.id,
      previous_payment: previousPayment,
    });
    return BaseModel.transaction(async (t) => {
      let newPayment;
      await gatewayMethod.createPayment(paymentData, { transacting: t })
        .then((p) => {
          newPayment = p;
          if(previousPayment) {
            previousPayment.set('retried_with_payment_id', newPayment.get('id'));
            return previousPayment.save(null, { transacting: t });
          }
          return newPayment;
        })
        .then(() => newPayment)
        .then(t.commit)
        .then(t.rollback);
    });
  },

  processEachPayment: function processEachPayment(paymentOrder, paymentData) {
    const payments = _.valuesIn(paymentData);
    const self = this;
    return helper.promiseSettleFirst(payments, async payment => {
      const gatewayMethods = await self.selectGatewayMethods(payment);
      return self.processPaymentWithRetries(gatewayMethods, payment, paymentOrder);
    });
  },

  processPaymentOrder: function processPaymentOrder(paymentOrder, paymentData) {
    return this.processEachPayment(paymentOrder, paymentData)
      .tap(() => {
        return this.calculateStatus(paymentOrder)
          .then((status) => {
            paymentOrder.set('status_id', status).save();
          });
      })
      .catch(err => paymentOrder
        .set('status_id', PaymentStatus.error)
        .save()
        .then(() => this.cancelPaymentOrderIfFailed(paymentOrder))
        .catch(() => {}) // This prevents the whole request to fail when the cancellation fails
        .then(() => { throw err; }))
      .tap(() =>
        this.cancelPaymentOrderIfFailed(paymentOrder)
          .catch(() => {})) // This prevents the whole request to fail when the cancellation fails
      .then((paymentResponses) => {
        const outResponse = this.buildProcessResponse(paymentResponses, paymentOrder);
        logger.debug('process_payment_order.outgoing_response', { body: outResponse });
        return outResponse;
      });
  },

  cancelPaymentOrder: function cancelPaymentOrder(paymentOrder) {
    return paymentIterator(
      paymentOrder,
      'payment_method.cancel_payment_order',
      Transitionable.unsafeInvalidTransitionsToStatus.cancelled,
      payment => payment.cancel(),
    );
  },

  chargeBackPaymentOrder: function chargeBackPaymentOrder(paymentOrder) {
    return paymentIterator(
      paymentOrder,
      'payment_method.charge_back_payment_order',
      Transitionable.unsafeInvalidTransitionsToStatus.chargedBack,
      payment => payment.chargeBack(),
    );
  },


  manualRefundPaymentOrder: function manualRefundPaymentOrder(paymentOrder) {
    return paymentIterator(
      paymentOrder,
      'payment_method.manual_refund_payment_order',
      Transitionable.unsafeInvalidTransitionsToStatus.refunded,
      payment => payment.manualRefunded(),
    );
  },

  executePaymentOrder: function executePaymentOrder(paymentOrder, metadata) {
    return paymentIterator(
      paymentOrder,
      'payment_method.executePaymentOrder',
      Transitionable.unsafeInvalidTransitionsToStatus.pendingExecute,
      payment => payment.execute(metadata),
    );
  },

  shouldCapturePayments: function shouldCapturePayments(po) {
    const shouldCapture = po.get('status_id') === PaymentStatus.authorized;
    return po.getRelation('validPayments').then((payments) => {
      const isCapturable = payments.any(p => p.get('status_id') === PaymentStatus.authorized);
      return shouldCapture && isCapturable;
    });
  },

  shouldRollbackPayments: function shouldRollbackPayments(po) {
    const shouldRollback = _.includes([PaymentStatus.rejected, PaymentStatus.error, PaymentStatus.cancelled], po.get('status_id'));

    return po.getRelation('validPayments').then((payments) => {
      const isCancelable = payments.any(p => _.includes([PaymentStatus.authorized,
        PaymentStatus.pendingAuthorize, PaymentStatus.successful,
        PaymentStatus.pendingCapture], p.get('status_id')));

      return shouldRollback && isCancelable;
    });
  },

  cancelPaymentOrderIfFailed: function cancelPaymentOrderIfFailed(paymentOrder) {
    return this.shouldRollbackPayments(paymentOrder)
      .then((res) => {
        if (res) {
          return this.cancelPaymentOrder(paymentOrder)
            .catch((err) => {
              logger.error('payment_method.process_payment_order.cancel_other_payments.error', {
                reference: paymentOrder.get('reference'),
                purchase_reference: paymentOrder.get('purchase_reference'),
                error: err,
              });
              throw err;
            });
        }
        return null;
      });
  },

  validatePaymentsCreation: async function validatePaymentsCreation(paymentData, paymentOrderId) {
    const payments = _.valuesIn(paymentData);
    await this.validatePayments(payments, paymentOrderId);

    return Promise.all(_.map(payments, async (payment) => {
      let gms = await this.selectGatewayMethods(payment);
      return helper.promiseAtLeastOne(gms, gm => gm.validatePaymentCreation(payment));
    }));
  },

  update: function updatePaymentMethod(data = {}) {
    const modifyData = {};

    if (_.isBoolean(data.enabled)) {
      modifyData.enabled = data.enabled;
    }

    if (_.isNumber(data.gateway_method_id)) {
      modifyData.gateway_method_id = data.gateway_method_id;
    }

    if (_.isEmpty(modifyData)) return Promise.resolve(this);

    return this.save(modifyData, { patch: true });
  },

  deleteOldGatewayConfiguration: async function deleteOldGatewayConfiguration(t) {
    logger.info('methods.update_method.deleting_old_payment_method_gateway_methods_configuration');
    const pmgms = await this.getRelation('paymentMethodGatewayMethods',{ transacting: t });
    if (!pmgms) {
      logger.debug('payment_methods.delete_old_gateway_configuration.do_not_have_any_configuration_to_delete');
    }
    const promises = _.map(pmgms.models, pmgm => pmgm.destroy({ transacting: t }));
    return Promise.all(promises)
      .catch((e) => {
        logger.info('payment_methods.delete_old_gateway_configuration.fail_to_destroy_gateway_configuration', { error: e });
        return e;
      });
  },

  createPaymenteMethodGatewayMethod: async function createPaymenteMethodGatewayMethod(gatewayMethod, t) {
    logger.info('payment_method.create_payment_method_gateway_method', {
      payment_method_id: this.id,
      gatewayMethod_id: gatewayMethod.id,
    })
    const pmgm = await PaymentMethodGatewayMethod
      .create({ payment_method_id: this.id, gateway_method_id: gatewayMethod.id, gateway_method_order: 1 }, t);
    return pmgm;
  },

  updateGatewayMethodsConfiguration: async function updateGatewayMethodsConfiguration(gatewayMethod) {
    logger.info('payment_method.update_gateway_methods_configuration.starting_to_update');
    return BaseModel.transaction((t) => {
      return this.deleteOldGatewayConfiguration(t)
        .then(() => {
          return this.createPaymenteMethodGatewayMethod(gatewayMethod,t);
        })
        .then(t.commit)
        .catch(t.rollback);
    });
  },
});
