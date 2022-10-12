const _ = require('lodash');
const moment = require('moment');
const ApiClient = require('../../services/api_client');
const errors = require('../../errors');
const knex = require('../base_model').bookshelf.knex;
const Promise = require('bluebird');
const log = require('../../logger');
const helpers = require('../../lib/helpers');
const PaymentStatus = require('../constants/payment_status');
const PaymentStatusDetail = require('../constants/payment_status_detail');
const Buyer = require('../buyer');
const EncryptionType = require('../constants/encryption_type');


const countryMap = {
  Brazil: 'BR',
  Argentina: 'AR',
};

const SUCCEED = 'succeed';
const FAILED = 'failed';

function generateIpnStatusMap(succeed, failed) {
  const map = {};
  if (succeed) {
    map[SUCCEED] = succeed;
  }
  if (failed) {
    map[FAILED] = failed;
  }
  return map;
}

const ipnStatusMap = {
  AUTHORISATION: generateIpnStatusMap(PaymentStatus.authorized, PaymentStatus.rejected),
  CAPTURE: generateIpnStatusMap(PaymentStatus.successful, PaymentStatus.rejected),
  CAPTURE_FAILED: generateIpnStatusMap(PaymentStatus.rejected),
  CANCELLATION: generateIpnStatusMap(PaymentStatus.cancelled, PaymentStatus.successful),
  REFUND: generateIpnStatusMap(PaymentStatus.refunded, PaymentStatus.successful),
  CANCEL_OR_REFUND: generateIpnStatusMap(PaymentStatus.refunded, PaymentStatus.successful),
  REFUND_FAILED: generateIpnStatusMap(PaymentStatus.successful),
  REFUNDED_REVERSED: generateIpnStatusMap(null, PaymentStatus.successful),
  ORDER_OPENED: generateIpnStatusMap(PaymentStatus.pendingAuthorize),
  ORDER_CLOSED: generateIpnStatusMap(PaymentStatus.cancelled),
  PENDING: generateIpnStatusMap(PaymentStatus.pendingAuthorize),
  REQUEST_FOR_INFORMATION: generateIpnStatusMap(PaymentStatus.inMediation),
  NOTIFICATION_OF_CHARGEBACK: generateIpnStatusMap(PaymentStatus.inMediation),
  CHARGEBACK: generateIpnStatusMap(PaymentStatus.chargedBack),
  CHARGEBACK_REVERSED: generateIpnStatusMap(PaymentStatus.successful),
  MANUAL_REVIEW_ACCEPT: generateIpnStatusMap(PaymentStatus.authorized),
  MANUAL_REVIEW_REJECT: generateIpnStatusMap(PaymentStatus.rejected),
};

const statusMap = {
  Authorised: PaymentStatus.authorized,
  Refused: PaymentStatus.rejected,
  Error: PaymentStatus.rejected,
  Received: PaymentStatus.pendingAuthorize,
};

const statusDetailsMap = {
  'Acquirer Fraud': PaymentStatusDetail.fraud,
  FRAUD: PaymentStatusDetail.fraud,
  'FRAUD-CANCELLED': PaymentStatusDetail.fraud,
  'Issuer Suspected Fraud': PaymentStatusDetail.fraud,
  'Issuer Unavailable': PaymentStatusDetail.fraud,
  'CVC Declined': PaymentStatusDetail.wrong_card_data,
  'Invalid Card Number': PaymentStatusDetail.wrong_card_data,
  'Invalid Pin': PaymentStatusDetail.wrong_card_data,
  'Declined Non Generic': PaymentStatusDetail.other,
  'Acquirer Error': PaymentStatusDetail.other,
  'Not Submitted': PaymentStatusDetail.other,
  Unknown: PaymentStatusDetail.other,
  'Invalid Amount': PaymentStatusDetail.other,
  'Blocked Card': PaymentStatusDetail.card_disabled,
  '3d-secure: Authentication failed': PaymentStatusDetail.other,
  Cancelled: PaymentStatusDetail.other,
  Refused: PaymentStatusDetail.other,
  'Expired Card': PaymentStatusDetail.card_disabled,
  'Not supported': PaymentStatusDetail.other,
  'Pin tries exceeded': PaymentStatusDetail.max_attempts_reached,
  'Pin validation not possible': PaymentStatusDetail.other,
  'Restricted Card': PaymentStatusDetail.card_disabled,
  'Revocation Of Auth': PaymentStatusDetail.other,
  'Shopper Cancelled': PaymentStatusDetail.other,
  'Withdrawal count exceeded': PaymentStatusDetail.other,
  'Transaction Not Permitted': PaymentStatusDetail.other,
  Referral: PaymentStatusDetail.other,
  'Not enough balance': PaymentStatusDetail.no_funds,
  'Withdrawal amount exceeded': PaymentStatusDetail.no_funds,
  Pending: PaymentStatusDetail.pending,
  'Card Absent Fraud': PaymentStatusDetail.charged_back,
  'No Cardholder Authorisation': PaymentStatusDetail.charged_back,
};

function getClient() {
  const basicAuth = this.getKey('basic');

  return new ApiClient(this.get('base_url'), {
    auth: {
      user: basicAuth.username,
      pass: basicAuth.password,
    },
  });
}

function createPayment(payment, requestData, options) {
  return this.createPaymentData(payment, requestData, options)
    .then((payload) => {
      log.debug('gateway.adyen.create_payment.starting_request', {
        client_reference: payment.get('client_reference'),
        body: helpers.maskCreatePaymentRequest(payload),
      });

      return this.getClient().post('/authorise', payload)
        .then((resp) => {
          if (resp.statusCode !== 200) {
            const body = _.merge({}, resp.data);
            delete body.pspReference;

            const err = new errors.FailResponseError(resp);
            err.code = 'adyen_request_has_errors';
            err.status = 400;
            err.context = {
              statusCode: resp.statusCode,
              adyenErrors: body,
            };
            throw err;
          }

          log.debug('gateway.adyen.create_payment.request_succeed', {
            client_reference: payment.get('client_reference'),
            response: resp.data,
          });

          return resp;
        })
        .catch((err) => {
          if (err.code && err.code === 'adyen_request_has_errors') {
            log.info('gateway.adyen.create_payment.non_200_response', {
              client_reference: payment.get('client_reference'),
              error: err.error,
            });
          } else {
            log.info('gateway.adyen.create_payment.request_failed', {
              client_reference: payment.get('client_reference'),
              error: err,
            });
          }

          throw err;
        });
    });
}

function cancelPayment(payment) {
  const meta = payment.get('metadata');

  const paymentLog = log.child({
    client_reference: payment.get('client_reference'),
  });

  paymentLog.debug('gateway.adyen.cancel_payment.starting_request');

  return this.getClient()
    .post('/cancelOrRefund', {
      merchantAccount: this.getKey('merchantAccount'),
      originalReference: meta.pspReference,
      reference: payment.get('client_reference'),
    })
    .then((resp) => {
      if (resp.statusCode !== 200 || resp.data.response !== '[cancelOrRefund-received]') {
        const body = _.merge({}, resp.data);
        delete body.pspReference;

        const err = new errors.FailResponseError(resp);
        err.code = 'adyen_request_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          adyenErrors: body,
        };


        if (resp.data.response !== '[cancelOrRefund-received]') {
          paymentLog.error('gateway.adyen.cancel_payment.unexpected_error', {
            error_message: resp.data.response,
          });
        }

        throw err;
      }

      paymentLog.debug('gateway.adyen.cancel_payment.request_succeed', {
        response: resp.data,
      });

      return {
        pending: true,
        cancelRequestReference: resp.data.pspReference,
      };
    })
    .catch((err) => {
      paymentLog.info('gateway.adyen.cancel_payment.request_failed', {
        error: err,
      });

      throw err;
    });
}

function capturePayment(payment) {
  const meta = payment.get('metadata');

  const paymentLog = log.child({
    client_reference: payment.get('client_reference'),
  });

  paymentLog.debug('gateway.adyen.capture_payment.starting_request');

  return this.getClient()
    .post('/capture', {
      merchantAccount: this.getKey('merchantAccount'),
      originalReference: meta.pspReference,
      modificationAmount: {
        value: parseInt(Math.round(payment.get('total') * 100), 10),
        currency: payment.get('currency'),
      },
      reference: payment.get('client_reference'),
    })
    .then((resp) => {
      if (resp.statusCode !== 200 || resp.data.response !== '[capture-received]') {
        const body = _.merge({}, resp.data);
        delete body.pspReference;

        const err = new errors.FailResponseError(resp);
        err.code = 'adyen_request_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          adyenErrors: body,
        };


        if (resp.data.response !== '[capture-received]') {
          paymentLog.error('gateway.adyen.capture_payment.unexpected_error', {
            error_message: resp.data.response,
          });
        }

        throw err;
      }

      paymentLog.debug('gateway.adyen.capture_payment.request_succeed', {
        response: resp.data,
      });

      return {
        captureRequestReference: resp.data.pspReference,
      };
    })
    .catch((err) => {
      paymentLog.info('gateway.adyen.capture_payment.request_failed', {
        error: err,
      });

      throw err;
    });
}

function shouldSkipIpn(notification) {
  return _.get(notification, 'NotificationRequestItem.eventCode') === 'REPORT_AVAILABLE';
}

function parseIpnPayload(payload) {
  return new Promise(((resolve, reject) => {
    if (!_.isArray(payload.notificationItems) || payload.notificationItems.length === 0) {
      reject(new errors.BadRequest('Payload does not contain notificationItems'));
    }

    let notifications = _.map(payload.notificationItems, (notification) => {
      if (!notification || !notification.NotificationRequestItem) {
        reject(new errors.BadRequest('A notification does not contain NotificationRequestItem'));
      }

      if (shouldSkipIpn(notification)) {
        return null;
      }

      return {
        client_reference: _.get(notification, 'NotificationRequestItem.merchantReference'),
        payloadJson: notification,
      };
    });

    notifications = _.filter(notifications, n => n != null);

    if (_.isEmpty(notifications)) {
      reject(new errors.SkipIpnError());
    } else {
      resolve(notifications);
    }
  }));
}

function ipnSuccessResponse(res) {
  return res.send('[accepted]');
}

function countFailedIpn(clientReferences, body) {
  if (!_.isArray(clientReferences) || clientReferences.length === 0) {
    return Promise.resolve(0);
  }

  return knex('failed_ipns')
    .whereIn('client_reference', clientReferences)
    .where('payload', JSON.stringify(body))
    .groupBy('client_reference')
    .count('* as count')
    .map(c => c.count)
    .then(c => _.max(c));
}

function ipnFailResponse(res, err, clientReferences, body) {
  const self = this;
  const logger = log.child({
    error: err,
    error_context: err ? err.context : null,
    client_references: clientReferences,
  });

  if (!_.isArray(clientReferences) || clientReferences.length === 0) {
    logger.warn('ipn.gateway_response.adyen.error.no_client_references_as_success');
    return Promise.resolve(self.ipnSuccessResponse(res));
  }

  return countFailedIpn(clientReferences, body)
    .then((failedIpns) => {
      const ipnLogger = log.child({
        failed_ipns: failedIpns,
      });

      if (failedIpns >= 3) {
        ipnLogger.warn('ipn.gateway_response.adyen.error.respond_as_success');
        return Promise.resolve(self.ipnSuccessResponse(res));
      }

      ipnLogger.warn('ipn.gateway_response.adyen.error.respond_with_error');
      return Promise.reject(err);
    });
}

function createPaymentData(payment, requestData) {
  const self = this;

  return payment.getRelation('paymentOrder')
    .then((paymentOrder) => {
      const buyerPromise = paymentOrder.getRelation('buyer');
      return buyerPromise.then((buyer) => {
        const installments = requestData.installments;

        const body = {
          additionalData: {
            'card.encrypted.json': helpers.getEncryptedToken(requestData, EncryptionType.adyen),
          },
          amount: {
            value: parseInt(Math.round(payment.get('total') * 100), 10),
            currency: payment.get('currency'),
          },
          installments: {
            value: installments,
          },
          reference: payment.get('client_reference'),
          merchantAccount: self.getKey('merchantAccount'),
          shopperIP: buyer.get('ip_address'),
          shopperEmail: buyer.get('email'),
          deliveryAddress: {
            street: buyer.get('shipping_street'),
            houseNumberOrName: buyer.get('shipping_number'),
            city: buyer.get('shipping_city'),
            postalCode: buyer.get('shipping_zip_code'),
            stateOrProvince: buyer.get('shipping_state'),
            country: countryMap[buyer.get('shipping_country')],
          },
          billingAddress: {
            street: buyer.get('billing_street'),
            houseNumberOrName: buyer.get('billing_number'),
            city: buyer.get('billing_city'),
            postalCode: buyer.get('billing_zip_code'),
            stateOrProvince: buyer.get('billing_state'),
            country: countryMap[buyer.get('billing_country')],
          },
          shopperName: {
            firstName: '',
            lastName: '',
            gender: '',
            infix: '',
          },
          socialSecurityNumber: buyer.get('document_number'),
          telephoneNumber: buyer.get('phone'),
          merchantOrderReference: payment.get('client_order_reference'),
        };

        if (buyer.get('type') === Buyer.PERSON_TYPE) {
          body.dateOfBirth = `${moment(buyer.get('birth_date')).format('YYYY-MM-DD')}T00:00:00Z`;
          body.shopperName.gender = buyer.get('gender') === 'M' ? 'MALE' : 'FEMALE';
          body.shopperName.firstName = buyer.get('first_name');
          body.shopperName.lastName = buyer.get('last_name');
        } else {
          body.shopperName.firstName = buyer.get('name');
        }

        return body;
      });
    });
}

function translateAuthorizeStatus(response) {
  const externalStatus = response.data.resultCode;
  return this.doStatusTranslation(statusMap, externalStatus)
    .then((status) => {
      // Special cases

      // If the response has fraudResultType equal to AMBER,
      // we should left it in pending state, so it can start
      // the Manual Review process.
      if (_.get(response.data, 'additionalData.fraudResultType') === 'AMBER'
                && externalStatus === 'Authorised') {
        return PaymentStatus.pendingAuthorize;
      }

      return status;
    });
}

function translateIpnStatus(ipnData, payment) {
  return new Promise((resolve, reject) => {
    const eventCode = _.get(ipnData, 'NotificationRequestItem.eventCode');
    const succeed = _.get(ipnData, 'NotificationRequestItem.success');

    if (!eventCode || !_.includes(['true', 'false'], succeed)) {
      return reject(new Error('Adyen :: IPN came without eventCode or success field'));
    }

    const succeedStatus = succeed === 'true' ? SUCCEED : FAILED;

    const status = _.get(ipnStatusMap, `${eventCode}.${succeedStatus}`);

    if (!status) {
      return reject(new errors.NoMatchingStatusError(`${eventCode}.${succeedStatus}`));
    }

    // Special cases

    // If an AUTHORISATION notification cames with fraudResultType
    // equal to AMBER, we should left it in pending state, so it
    // can start the Manual Review process.

    if (eventCode === 'AUTHORISATION'
                && succeedStatus === SUCCEED
                && _.get(ipnData, 'NotificationRequestItem.additionalData.fraudResultType') === 'AMBER') {
      return resolve(PaymentStatus.pendingAuthorize);
    }

    return resolve(status);
  })
    .then((status) => {
      // Dude we cancel payments with CANCEL_OR_REFUND, we have
      // to check in the payment history weather it's really
      // refunded or it was cancelled/rejected.
      if (status !== PaymentStatus.refunded) {
        return status;
      }

      return payment.history()
        .then((h) => {
          if (_.includes(h, PaymentStatus.successful)) {
            return PaymentStatus.refunded;
          }

          const cancelledStatuses = [PaymentStatus.pendingCancel, PaymentStatus.cancelled];
          if (_.intersection(h, cancelledStatuses).length >= 1) {
            return PaymentStatus.cancelled;
          }

          return PaymentStatus.rejected;
        });
    });
}

function translateIpnStatusDetail(ipnData) {
  const rawStatusDetail = _.get(ipnData, 'NotificationRequestItem.reason');
  return this.doStatusTranslation(statusDetailsMap, rawStatusDetail);
}

function translateAuthorizeStatusDetail(response) {
  const rawStatusDetail = response.data.refusalReason;
  return this.doStatusTranslation(statusDetailsMap, rawStatusDetail);
}

function buildPaymentInformation(resp, requestData) {
  return requestData.paymentInformation || {};
}

const extractGatewayReference = response => response.data.pspReference;

function buildMetadata(response) {
  return {
    pspReference: response.data.pspReference,
    authCode: response.data.authCode,
    modificationPspReferences: [],
  };
}

module.exports = {
  type: 'ADYEN',
  statusMap,
  statusDetailsMap,
  createPayment,
  cancelPayment,
  ipnSuccessResponse,
  ipnFailResponse,
  getClient,
  parseIpnPayload,
  createPaymentData,
  translateIpnStatus,
  translateAuthorizeStatus,
  extractGatewayReference,
  buildMetadata,
  translateIpnStatusDetail,
  translateAuthorizeStatusDetail,
  capturePayment,
  buildPaymentInformation,
};
