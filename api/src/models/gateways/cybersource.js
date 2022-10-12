const errors = require('../../errors');
const Promise = require('bluebird');
const PaymentStatusDetail = require('../constants/payment_status_detail');
const PaymentStatus = require('../constants/payment_status');
const cybersourceHelper = require('../../services/cybersource_helper');
const CyberSourceResponseHandler = require('../../services/cybersource_response_handler');
const SoapClient = require('../../services/soap_client');
const Services = require('../constants/cybersource_services');
const CybersourceMapper = require('../../mappers/cybersource_mapper');
const log = require('../../logger');
const _ = require('lodash');
const CybersourceStatus = require('../constants/cybersource_statuses');
const QueueService = require('../../services/queue_service');
const helpers = require('../../lib/helpers');
const retrier = require('../payment_retriers/cybersource_retrier');

const CAPTURE_DELAY = 7000;
const statusMap = {};
const statusDetailsMap = {
  100: PaymentStatusDetail.ok,
  101: PaymentStatusDetail.wrong_card_data,
  102: PaymentStatusDetail.wrong_card_data,
  103: PaymentStatusDetail.other,
  104: PaymentStatusDetail.duplicated_payment,
  150: PaymentStatusDetail.unknown,
  151: PaymentStatusDetail.timeout,
  152: PaymentStatusDetail.other,
  153: PaymentStatusDetail.account_not_enabled,
  201: PaymentStatusDetail.call_for_authorize,
  202: PaymentStatusDetail.expired,
  203: PaymentStatusDetail.decline_card,
  204: PaymentStatusDetail.no_funds,
  205: PaymentStatusDetail.stolen_or_lost_card,
  206: PaymentStatusDetail.other,
  207: PaymentStatusDetail.other,
  208: PaymentStatusDetail.rejected_by_bank,
  231: PaymentStatusDetail.invalid_account_number,
  232: PaymentStatusDetail.card_type_not_accepted,
  233: PaymentStatusDetail.rejected_by_bank,
  234: PaymentStatusDetail.other,
  240: PaymentStatusDetail.wrong_card_data,
  250: PaymentStatusDetail.gateway_error,
  400: PaymentStatusDetail.automatic_fraud,
  480: PaymentStatusDetail.pending,
  481: PaymentStatusDetail.automatic_fraud,
  999: PaymentStatusDetail.manual_review,
};
const mapper = new CybersourceMapper();

function getClient() {
  const soapClient = new SoapClient(`${this.get('base_url')}/transactionProcessor/CyberSourceTransaction_1.151.wsdl`);
  return soapClient.setSecurity(this.getKey('merchant_id'), this.getKey('transaction_key')).then(() => {
    return soapClient;
  });
}

function getTokenizerKey() {
  return cybersourceHelper.getTokenizerKey(this);
}

function cancelPayment(payment) {
  return Promise.rejected();
}

function capturePayment(payment) {
  return Promise.all([
    this.getCaptureData(payment),
    helpers.sleep(CAPTURE_DELAY),
  ]).then((results) => {
    const payload = results[0];
    return this.getClient().then(client => client.runAction('runTransaction', payload))
      .then((response) => {
        if (response.result.reasonCode === 242) {
          log.info('gateway.cybersource.capture_payment.error.cybersource_internal_error', {
            client_reference: payment.get('client_reference'),
            gateway_reference: payment.get('gateway_reference'),
          });
        }

        if (response.result.decision !== CybersourceStatus.accept) {
          throw new Error('Capture was not accepted by gateway');
        }
        return response;
      })
      .catch((err) => {
        log.error('gateway.cybersource.capture_payment.error', {
          client_reference: payment.get('client_reference'),
          gateway_reference: payment.get('gateway_reference'),
          error: err.error,
        });
        throw err;
      });
  });
}

function ipnSuccessResponse(res) {
  return res.status(200).end();
}

function translateAuthorizeStatus(response, payment) {
  const dmDecision = _.get(response, 'decisionManager.decision');
  const authDecision = _.get(response, 'authorization.decision');

  if (dmDecision === CybersourceStatus.accept && authDecision === CybersourceStatus.accept) {
    return Promise.resolve(PaymentStatus.authorized);
  } else if (dmDecision === CybersourceStatus.review && authDecision === CybersourceStatus.accept) {
    return Promise.resolve(PaymentStatus.pendingAuthorize);
  }
  return Promise.resolve(PaymentStatus.rejected);
}

function ipnFailResponse(res, err) {
  if (err.message === 'One or more ipns failed') {
    err.status = 500;
  }

  throw err;
}

function shouldSkipIpn(payload) {
  const decision = _.get(payload, 'decision');
  const originalDecision = _.get(payload, 'originalDecision');
  return originalDecision && !decision;
}

function parseIpnPayload(payload) {
  if (!payload) {
    return Promise.reject(new errors.ParseIpnError());
  }

  let ipnInfo;
  try {
    ipnInfo = this.extractDataFromIpn(payload);
  } catch (err) {
    log.error('gateway.cybersource.parse_ipn_payload.error', {
      payload,
      error: err.error,
    });
    return Promise.reject(new errors.ParseIpnError());
  }

  if (this.shouldSkipIpn(ipnInfo)) {
    return Promise.reject(new errors.SkipIpnError());
  }

  return Promise.resolve([{
    client_reference: ipnInfo.reference,
    payloadJson: payload,
  }]);
}

function extractDataFromIpn(payload) {
  const content = payload.content;
  const originalDecision = _.get(/<OriginalDecision>(.*)<\/OriginalDecision>/gm.exec(content), '[1]');
  const decision = _.get(/<NewDecision>(.*)<\/NewDecision>/gm.exec(content), '[1]');
  const reference = _.get(/MerchantReferenceNumber="(.*)" /gm.exec(content), '[1]');

  if (!reference) {
    throw new Error('Webhook does not contain payment id');
  }

  if (!decision && !originalDecision) {
    throw new Error('Could not extract decisions from notification');
  }

  return { decision, reference, originalDecision };
}

function buildMetadata(response) {
  const authDecision = _.get(response, 'authorization.decision');

  if (authDecision === CybersourceStatus.accept && !_.get(response, 'authorization.requestID')) {
    log.error('cybersource.build_metadata.error', {response});
    throw new Error('No requestId in the metadata');
  }

  return {
    authRequestId: _.get(response, 'authorization.requestID'),
    authRequestToken: _.get(response, 'authorization.requestToken'),
    authReconciliationID: _.get(response, 'authorization.ccAuthReply.reconciliationID'),
    authAuthorizationCode: _.get(response, 'authorization.ccAuthReply.authorizationCode'),
    authProcessorTransactionID: _.get(response, 'authorization.ccAuthReply.processorTransactionID'),
    authPaymentNetworkTransactionID: _.get(response, 'authorization.ccAuthReply.paymentNetworkTransactionID'),
    authDecision,
    dmRequestId: _.get(response, 'decisionManager.requestID'),
    dmRequestToken: _.get(response, 'decisionManager.requestToken'),
    dmDecision: _.get(response, 'decisionManager.decision'),
  };
}

function translateIpnStatus(ipnData, payment) {
  let decision;

  try {
    decision = this.extractDataFromIpn(ipnData).decision;
  } catch (err) {
    return Promise.reject(err);
  }

  if (CybersourceStatus.accept === decision) {

    if (payment.get('status_id') === PaymentStatus.rejected) {
      return Promise.resolve(PaymentStatus.rejected);
    }

    if (payment.get('status_id') === PaymentStatus.cancelled) {
      return Promise.resolve(PaymentStatus.cancelled);
    }

    return Promise.resolve(PaymentStatus.authorized);
  }

  if (CybersourceStatus.reject === decision) {
    return Promise.resolve(PaymentStatus.rejected);
  }

  return Promise.reject(new errors.NoMatchingStatusError(decision));
}

function translateIpnStatusDetail(ipnData, payment) {
  let decision;

  try {
    decision = this.extractDataFromIpn(ipnData).decision;
  } catch (err) {
    return Promise.reject(err);
  }

  if (CybersourceStatus.accept === decision) {
    return Promise.resolve(PaymentStatusDetail.ok);
  }

  if (CybersourceStatus.reject === decision) {
    return Promise.resolve(PaymentStatusDetail.manual_fraud);
  }

  return Promise.resolve(PaymentStatusDetail.unknown);
}

function createPaymentData(payment, requestData, options) {
  return payment.getRelation('paymentOrder')
    .then((paymentOrder) => {
      const buyerPromise = paymentOrder.getRelation('buyer');
      const itemsPromise = paymentOrder.getRelation('items');
      const paymentsPromise = paymentOrder.getRelation('validPayments');

      return Promise.join(buyerPromise, itemsPromise, paymentsPromise, (buyer, items, payments) => {

        const aditionalData = {
          amountOfPayments: payments.length,
          dmRequestId: options.dmRequestId,
        };

        const args = [payment, paymentOrder, buyer, items, requestData];

        switch (options.requestedService) {
          case Services.decisionManager: {
            return this.mapper.getDecisionManagerXML(...args, aditionalData);
          }
          case Services.authorization: {
            return this.mapper.getAuthorizationXML(...args);
          }
          case Services.capture: {
            return this.mapper.getCaptureXML(...args);
          }
          case Services.credit: {
            return this.mapper.getCreditXML(...args);
          }
          case Services.void: {
            return this.mapper.getVoidXML(...args);
          }
          case Services.chargeback: {
            return this.mapper.getChargebackXML(...args);
          }
          case Services.authorizationReversal: {
            return this.mapper.getAuthorizationReversalXML(...args);
          }
          case Services.manuallyRejectCase: {
            return this.mapper.getManuallyRejectCaseXML(...args, aditionalData);
          }
          default: {
            return Promise.reject(new Error('The requested CyberSource service is not implemented'));
          }
        }
      }).catch((err) => {
        log.error('gateway.cybersource.create_payment_data.mapping_error', {
          client_reference: payment.get('client_reference'),
          gateway_reference: payment.get('gateway_reference'),
          payment_id: payment.get('id'),
          purchase_reference: paymentOrder.get('purchase_reference'),
          payment_order_id: paymentOrder.get('id'),
          error: err,
          requested_service: options.requestedService,
        });
        throw err;
      });
    });
}

function getAuthorizationData(payment, requestData, options) {
  options.requestedService = Services.authorization;
  return this.createPaymentData(payment, requestData, options);
}

function getDecisionManagerData(payment, requestData, rawOptions) {
  const options = rawOptions || {};
  options.requestedService = Services.decisionManager;
  return this.createPaymentData(payment, requestData, options);
}

function getCaptureData(payment, requestData, rawOptions) {
  const options = rawOptions || {};
  options.requestedService = Services.capture;
  return this.createPaymentData(payment, requestData, options);
}

function getCreditData(payment, requestData, rawOptions) {
  const options = rawOptions || {};
  options.requestedService = Services.credit;
  return this.createPaymentData(payment, requestData, options);
}

function getVoidData(payment, requestData, rawOptions) {
  const options = rawOptions || {};
  options.requestedService = Services.void;
  return this.createPaymentData(payment, requestData, options);
}

function getChargebackData(payment, requestData, rawOptions) {
    const options = rawOptions || {};
    options.requestedService = Services.chargeback;
    return this.createPaymentData(payment, requestData, options);
}

function getAuthorizationReversalData(payment, requestData, rawOptions) {
  const options = rawOptions || {};
  options.requestedService = Services.authorizationReversal;
  return this.createPaymentData(payment, requestData, options);
}

function getManuallyRejectCaseData(payment, requestData, rawOptions) {
  const options = rawOptions || {};
  options.requestedService = Services.manuallyRejectCase;
  return this.createPaymentData(payment, requestData, options);
}

function chargeBackPayment(payment, requestData, options) {
    return this.getChargebackData(payment).then((payload) => {
        return this.getClient().then(client => client.runAction('runTransaction', payload))
            .then((response) => {
                if (response.result.decision !== CybersourceStatus.accept) {
                    throw new Error('Chargeback was not accepted by gateway');
                }
                return response;
            })
            .catch((err) => {
                log.error('gateway.cybersource.chargeback_payment.error', {
                    client_reference: payment.get('client_reference'),
                    gateway_reference: payment.get('gateway_reference'),
                    error: err.error,
                });
                throw err;
            });
    });
}

function authorizePayment(payment, requestData, options, mockAuthorize = false) {
  if (mockAuthorize) {
    return this.getMockedAuthorize();
  }
  return this.getAuthorizationData(payment, requestData, options).then((payload) => {
    return this.getClient().then(client => client.runAction('runTransaction', payload))
      .catch((err) => {
        log.error('cybersource.authorize_payment.request_failed', {
          payment_id: payment.get('id'),
          error: err,
        });
        throw err;
      });
  });
}

function getMockedAuthorize() {
  const result = {
    merchantReferenceCode: 'MERCHANT_REFERENCE_CODE',
    requestID: 'AUTH_REQUEST_ID',
    decision: 'REJECT',
    reasonCode: 999,
    requestToken: 'REQUEST_TOKEN',
    purchaseTotals: {currency: 'BRL'},
    ccAuthReply:
      {
        reasonCode: 999,
        amount: '1000.00',
        authorizationCode: 'AUTHORIZATION_CODE',
        avsCode: '1',
        authorizedDateTime: '1000-01-01T00:00:00.000Z',
        processorResponse: '1',
        reconciliationID: 'RECONCILIATION_ID',
        processorTransactionID: 'PROCESSOR_TID',
        paymentNetworkTransactionID: 'PAYMENT_NETWORK_TID',
      },
  };
  return Promise.resolve({result});
}

function decisionManagerPayment(payment, requestData, options) {
  return this.getDecisionManagerData(payment, requestData, options).then((payload) => {
    return this.getClient().then(client => client.runAction('runTransaction', payload))
      .catch((err) => {
        log.error('cybersource.decision_manager_payment.request_failed', {
          payment_id: payment.get('id'),
          request_data: helpers.maskCreatePaymentRequest(requestData),
          error: err,
        });
        throw err;
      });
  });
}

function creditPayment(payment) {
  return this.getCreditData(payment).then((payload) => {
    return this.getClient().then(client => client.runAction('runTransaction', payload))
      .then((response) => {
        if (response.result.decision !== CybersourceStatus.accept) {
          throw new Error('Credit was not accepted by gateway');
        }
        return response;
      })
      .catch((err) => {
        log.error('cybersource.credit_payment.request_failed', {
          payment_id: payment.get('id'),
          client_reference: payment.get('client_reference'),
          gateway_reference: payment.get('gateway_reference'),
          error: err,
        });
        throw err;
      });
  });
}

function voidPayment(payment) {
  return this.getVoidData(payment).then((payload) => {
    return this.getClient().then(client => client.runAction('runTransaction', payload))
      .then((response) => {
        if (response.result.decision !== CybersourceStatus.accept) {
          throw new Error('Void was not accepted by gateway');
        }
        return response;
      })
      .catch((err) => {
        log.warn('cybersource.void.request_failed', {
          payment_id: payment.get('id'),
          client_reference: payment.get('client_reference'),
          gateway_reference: payment.get('gateway_reference'),
          error: err,
        });
        throw err;
      });
  });
}

function manuallyRejectCase(payment, requestData, options) {
  return this.getManuallyRejectCaseData(payment, requestData, options).then((payload) => {
    return this.getClient().then(client => client.runAction('runTransaction', payload))
      .then((response) => {
        if (response.result.decision !== CybersourceStatus.accept) {
          throw new Error('Manually reject case was not accepted by gateway');
        }
        return response;
      })
      .catch((err) => {
        log.error('cybersource.manually_reject_case.request_failed', {
          payment_id: payment.get('id'),
          client_reference: payment.get('client_reference'),
          gateway_reference: payment.get('gateway_reference'),
          error: err,
        });
        throw err;
      });
  });
}

function authorizationReversePayment(payment) {
  return this.getAuthorizationReversalData(payment).then((payload) => {
    return this.getClient().then(client => client.runAction('runTransaction', payload))
      .then((response) => {
        if (response.result.decision !== CybersourceStatus.accept) {
          throw new Error('Authorization reversal was not accepted by gateway');
        }
        return response;
      })
      .catch((err) => {
        log.error('cybersource.authorization_reversal.request_failed', {
          payment_id: payment.get('id'),
          client_reference: payment.get('client_reference'),
          gateway_reference: payment.get('gateway_reference'),
          error: err,
        });
        throw err;
      });
  });
}

function allowedManualReview() {
  return Math.random() >= this.getKey('manual_review_enabled_percentage');
}

function createPayment(payment, requestData, options) {
  const gatewayResponses = new CyberSourceResponseHandler();
  return this.decisionManagerPayment(payment, requestData, options).then((dmResponse) => {
    gatewayResponses.setDecisionManager(dmResponse.result);
    if (gatewayResponses.dmPassed()) {
      const manualReviewEnabled = this.allowedManualReview();
      const mockAuthorize = (!manualReviewEnabled && gatewayResponses.dmReviewed());
      return this.authorizePayment(payment, requestData, options, mockAuthorize).then((authResponse) => {
        gatewayResponses.setAuthorization(authResponse.result);
        return gatewayResponses;
      }).then((gatewayResponses) => {
        if (gatewayResponses.dmReviewedButAuthRejected()) {
          const dmRequestId = _.get(gatewayResponses, 'decisionManager.requestID');

          this.addToCancelDecisionManagerQueue(payment, dmRequestId).catch((err) => {
            log.error('gateway.cybersource.create_payment.add_to_cancel_decision_manager_queue.error', {
              context: {
                decisionManager: dmRequestId,
                payment: payment.id
              },
              error: err,
            });
          });

        }
        return gatewayResponses;
      });
    }
    log.debug('cybersource_gateway_response_debug', {
      cybersource_response: gatewayResponses,
    });
    return gatewayResponses;
  });
}

function addToCancelDecisionManagerQueue(payment, dmId) {
  return QueueService.cancelDecisionManagerCybersource(payment, dmId);
}

function translateAuthorizeStatusDetail(response, payment) {
  if (_.includes([CybersourceStatus.reject, CybersourceStatus.error], response.decisionManager.decision)) {
    return this.doStatusTranslation(statusDetailsMap, response.decisionManager.reasonCode);
  }
  return this.doStatusTranslation(statusDetailsMap, response.authorization.reasonCode);
}

function buildPaymentInformation(resp, requestData) {
  return requestData.paymentInformation || {};
}

const extractGatewayReference = (response) => {

  if (_.get(response, 'decisionManager.decision' === CybersourceStatus.reject)) {
    return _.get(response, 'decisionManager.requestID') //When rejected, we set the requestID as gateway reference.
  }
  if (!_.get(response, 'decisionManager.merchantReferenceCode')) {
    log.error('cybersource.extract_gateway_reference', {
      decisionManager: response.decisionManager,
      authorization: response.authorization,
    });
    throw new Error('Could not extract gateway reference');
  }
  return response.decisionManager.merchantReferenceCode;
};

module.exports = {
  type: 'CYBERSOURCE',
  statusMap,
  statusDetailsMap,
  mapper,
  retrier,
  createPayment,
  createPaymentData,
  getDecisionManagerData,
  getAuthorizationData,
  getAuthorizationReversalData,
  getVoidData,
  getCaptureData,
  getChargebackData,
  getManuallyRejectCaseData,
  chargeBackPayment,
  translateAuthorizeStatus,
  translateAuthorizeStatusDetail,
  buildPaymentInformation,
  extractGatewayReference,
  cancelPayment,
  capturePayment,
  ipnSuccessResponse,
  ipnFailResponse,
  getClient,
  parseIpnPayload,
  shouldSkipIpn,
  buildMetadata,
  translateIpnStatusDetail,
  translateIpnStatus,
  authorizePayment,
  decisionManagerPayment,
  creditPayment,
  authorizationReversePayment,
  voidPayment,
  getCreditData,
  extractDataFromIpn,
  getTokenizerKey,
  manuallyRejectCase,
  addToCancelDecisionManagerQueue,
  getMockedAuthorize,
  allowedManualReview
};
