const _ = require('lodash');
const BaseModel = require('./base_model.js');
const errors = require('../errors');
const Promise = require('bluebird');
const mixins = require('./gateways');
const log = require('../logger');
const PaymentStatus = require('./constants/payment_status.js');
const PaymentStatusDetail = require('./constants/payment_status_detail.js');
const retrier = require('./payment_retriers/null_retrier');

function getMixin(type) {
  const mixin = mixins[type];
  if (!mixin) {
    throw new Error(`Unsupported gateway type: ${type}`);
  }
  return mixin;
}

module.exports = BaseModel.extend({
  tableName: 'gateways',

  validations: {
    tenant_id: ['required', 'naturalNonZero'],
    type: ['required', 'minLength:1', 'maxLength:255'],
    name: ['required', 'minLength:1', 'maxLength:255'],
    keys: ['required'],
    base_url: ['required', 'url', 'maxLength:255'],
  },
  retrier,

  initialize(...args) {
    BaseModel.prototype.initialize.apply(this, args);

    this.on('fetched', Promise.method(function extendMixin() {
      const mixin = getMixin(this.get('type'));
      _.extend(this, mixin);
    }));
  },

  getKey(keyName) {
    const key = _.get(this.get('keys'), keyName, null);
    if (key === null) {
      throw new errors.InternalServerError('Unexpected keyName', {
        key: keyName,
        gateway: this.get('name'),
      });
    }
    return key;
  },

  saveIncomingIpn(payload, payment) {
    log.debug('save_incoming_ipn', { client_reference: payment && payment.get('client_reference') });

    return require('./incoming_ipn').forge({
      tenant_id: this.get('tenant_id'),
      gateway_id: this.get('id'),
      payload,
      payment_id: payment ? payment.get('id') : null,
      process_status: payment ? payment.get('status_id') : null,
    }).save();
  },

  saveFailedIpn(payload, reference, error) {
    log.debug('save_failed_ipn', {
      gateway_id: this.get('id'),
      client_reference: reference,
    });

    return require('./failed_ipn').forge({
      tenant_id: this.get('tenant_id'),
      gateway_id: this.get('id'),
      client_reference: reference || null,
      payload,
      message: error.message || error.code || null,
    })
      .save();
  },

  processIpn: function processIpn(payment, ipnData) {
    return this.processIpnRequest(payment, ipnData)
      .then((resolvedStatuses) => {
        const gatewayMethod = payment.related('gatewayMethod');
        const originalStatus = payment.get('status_id');
        return gatewayMethod.saveIpnResult(payment, resolvedStatuses).tap(() => {
          return this.postIpnProcessAction(payment, ipnData, resolvedStatuses, originalStatus)
        });
      })
      .catch(errors.SkipIpnError, () => {
        return {
          payment,
          propagate: false,
        };
      });
  },

  sendPayment(payment, requestData, options) {
    return this.createPayment(payment, requestData, options)
      .then((resp) => {
        return Promise.join(
          this.processAuthorizeResponse(payment, resp), this.extractRedirectUrl(resp, requestData, payment),
          (data, redirectUrl) => {
            const paymentInformation = this.buildPaymentInformation(resp, requestData);
            const shouldRetry = this.retrier.shouldRetry(data);
            return {
              paymentStatus: data.status,
              installments: requestData.installments,
              gatewayReference: this.extractGatewayReference(resp),
              metadata: this.buildMetadata(resp, requestData),
              statusDetail: data.statusDetail,
              success: true,
              paymentInformation: _.isEmpty(paymentInformation) ? null : paymentInformation,
              redirectUrl,
              shouldRetry,
            };
          },
        );
      });
  },

  processAuthorizeResponse(payment, resp) {
    const paymentStatusPromise = this.translateAuthorizeStatus(resp, payment)
      .catch(errors.NoMatchingStatusError, (err) => {
        log.error('payment_creation.incoming_response.unhandled_external_status', {
          client_reference: payment.get('client_reference'),
          gateway_status: err.unknownStatus,
          message: 'Failed to translate external payment status. Set default to pending'
        });

        return PaymentStatus.pendingAuthorize;
      });

    const paymentStatusDetailPromise = this.translateAuthorizeStatusDetail(resp, payment)
      .catch(errors.NoMatchingStatusError, (err) => {
        log.warn('payment_creation.incoming_response.unhandled_external_status_detail', {
          client_reference: payment.get('client_reference'),
          gateway_status_detail: err.unknownStatus,
          message: 'Failed to translate external payment status detail. Set default to unknown'
        });

        return PaymentStatusDetail.unknown;
      });

    return Promise.join(
      paymentStatusPromise, paymentStatusDetailPromise,
      (status, statusDetail) => ({
        status,
        statusDetail,
      }),
    );
  },

  postIpnProcessAction: function postIpnProcessAction(payment, ipnData, resolvedStatuses, originalStatus) {
    return payment.getRelation('gatewayMethod').then((gm) => {
      return gm.postIpnProcessAction(payment, ipnData, resolvedStatuses, originalStatus).catch((err) => {
        log.error('gateway.post_ipn_process_action.failed', {
          error_code: err.code,
          payment_gateway_reference: payment.get('gateway_reference'),
          payment_client_reference: payment.get('client_reference'),
          payment_id: payment.get('id'),
        });
        throw err;
      });
    })
  },

  processIpnRequest: function processIpnRequest(payment, req) {
    const paymentStatusPromise = this.translateIpnStatus(req, payment)
      .catch(errors.NoMatchingStatusError, (err) => {
        log.error('process_ipn.unhandled_external_status', {
          client_reference: payment.get('client_reference'),
          gateway_status: err.unknownStatus,
          message: 'Skipping untranslated external status',
        });

        throw new errors.SkipIpnError();
      });

    const paymentStatusDetailPromise = this.translateIpnStatusDetail(req, payment)
      .catch(errors.NoMatchingStatusError, (err) => {
        log.warn('process_ipn.unknown_status_detail', {
          client_reference: payment.get('client_reference'),
          gateway_status_detail: err.unknownStatus,
        });

        return PaymentStatusDetail.unknown;
      });

    return Promise.join(
      paymentStatusPromise, paymentStatusDetailPromise,
      (status, statusDetail) => ({
        status,
        statusDetail,
      }),
    );
  },

  doStatusTranslation: function doTranslateStatusDetail(map, rawStatusDetail) {
    const statusDetail = map[rawStatusDetail];

    if (!statusDetail) {
      return Promise.reject(new errors.NoMatchingStatusError(rawStatusDetail));
    }

    return Promise.resolve(statusDetail);
  },

  buildMetadata: () => null,
  extractRedirectUrl: () => null,
});
