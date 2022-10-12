const _ = require('lodash');
require('moment');
const ApiClient = require('../../services/api_client');
const errors = require('../../errors');
const Promise = require('bluebird');
const log = require('../../logger');
const helpers = require('../../lib/helpers');
const PaymentStatus = require('../constants/payment_status');
const PaymentStatusDetail = require('../constants/payment_status_detail');
const PaymentTypes = require('../constants/payment_type');
const Buyer = require('../buyer');
const EncryptionType = require('../constants/encryption_type');

const SUPPORTED_WEBHOOK_ACTION_TYPES = ['payment'];
const STATEMENT_DESCRIPTOR = 'TROCAFONE';
const DEFAULT_PAYMENT_DESCRIPTION = 'Trocafone';
const PRODUCT_CATEGORY_ID = 'services';

const MERCADOPAGO_PROCESSORS_MAP = {
  visa: 'visa',
  amex: 'amex',
  mastercard: 'master',
  mercadolibre: 'melicard',
  diners: 'diners',
  hipercard: 'hipercard',
  elo: 'elo',
};

const statusMap = {
  pending: PaymentStatus.pendingClientAction,
  dunning: PaymentStatus.pendingClientAction,
  paid: PaymentStatus.successful,
  unpaid: PaymentStatus.rejected,
  approved: PaymentStatus.successful,
  authorized: PaymentStatus.authorized,
  in_process: PaymentStatus.pendingAuthorize,
  in_mediation: PaymentStatus.inMediation,
  rejected: PaymentStatus.rejected,
  cancelled: PaymentStatus.cancelled,
  refunded: PaymentStatus.refunded,
  charged_back: PaymentStatus.chargedBack,
};

const statusDetailsMap = {
  accredited: PaymentStatusDetail.ok,
  pending_contingency: PaymentStatusDetail.pending,
  pending_review_manual: PaymentStatusDetail.pending,
  pending_capture: PaymentStatusDetail.pending,
  cc_rejected_bad_filled_card_number: PaymentStatusDetail.wrong_card_data,
  cc_rejected_bad_filled_date: PaymentStatusDetail.wrong_card_data,
  cc_rejected_bad_filled_other: PaymentStatusDetail.wrong_card_data,
  cc_rejected_bad_filled_security_code: PaymentStatusDetail.wrong_card_data,
  cc_rejected_invalid_installments: PaymentStatusDetail.invalid_installment,
  cc_rejected_blacklist: PaymentStatusDetail.card_in_blacklist,
  cc_rejected_call_for_authorize: PaymentStatusDetail.call_for_authorize,
  cc_rejected_card_disabled: PaymentStatusDetail.card_disabled,
  cc_rejected_max_attempts: PaymentStatusDetail.max_attempts_reached,
  cc_rejected_card_error: PaymentStatusDetail.other,
  cc_rejected_other_reason: PaymentStatusDetail.other,
  cc_rejected_duplicated_payment: PaymentStatusDetail.duplicated_payment,
  cc_rejected_high_risk: PaymentStatusDetail.fraud,
  cc_rejected_insufficient_amount: PaymentStatusDetail.no_funds,
  rejected_high_risk: PaymentStatusDetail.fraud,
  payer_unavailable: PaymentStatusDetail.other,
  refunded: PaymentStatusDetail.refunded,
  settled: PaymentStatusDetail.charged_back,
  by_collector: PaymentStatusDetail.by_merchant,
  by_payer: PaymentStatusDetail.by_payer,
  bpp_refunded: PaymentStatusDetail.refunded,
  reimbursed: PaymentStatusDetail.charged_back,
  in_process: PaymentStatusDetail.pending,
  pending: PaymentStatusDetail.pending,
  expired: PaymentStatusDetail.expired,
  partially_refunded: PaymentStatusDetail.partial_refund,
  pending_waiting_payment: PaymentStatusDetail.pending,
  rejected_insufficient_data: PaymentStatusDetail.wrong_ticket_data,
  rejected_by_bank: PaymentStatusDetail.rejected_by_bank,
  by_admin: PaymentStatusDetail.fraud,
};

function getClient() {
  return new ApiClient(this.get('base_url'), {
    queryParams: {
      access_token: this.getKey('accessToken'),
    },
  });
}

function createPayment(payment, requestData, options) {
  return this.createPaymentData(payment, requestData, options)
    .then((payload) => {
      log.debug('gateway.mercadopago.create_payment.starting_request', {
        client_reference: payment.get('client_reference'),
        body: helpers.maskCreatePaymentRequest(payload),
      });

      return this.getClient().post('/payments', payload)
        .then((resp) => {
          if (resp.statusCode !== 200 && resp.statusCode !== 201) {
            const err = new errors.FailResponseError(resp);
            err.code = 'mercadopago_request_has_errors';
            err.status = 400;
            err.context = {
              statusCode: resp.statusCode,
              mercadopagoErrors: resp.data,
            };
            throw err;
          }

          log.debug('gateway.mercadopago.create_payment.request_succeed', {
            client_reference: payment.get('client_reference'),
            response: resp.data,
          });

          return resp;
        })
        .catch((err) => {
          if (err.code && err.code === 'mercadopago_request_has_errors') {
            log.info('gateway.mercadopago.create_payment.non_200_response', {
              client_reference: payment.get('client_reference'),
              error: err.error,
            });
          } else {
            log.info('gateway.mercadopago.create_payment.request_failed', {
              client_reference: payment.get('client_reference'),
              error: err,
            });
          }

          throw err;
        });
    });
}

function cancelPayment(payment) {
  const paymentLog = log.child({
    client_reference: payment.get('client_reference'),
  });
  paymentLog.debug('gateway.mercadopago.cancel_payment.starting_request');
  const postUrl = `/payments/${payment.get('gateway_reference')}`;

  return this.getClient()
    .put(postUrl, {
      status: 'cancelled',
    })
    .then((resp) => {
      if (resp.statusCode !== 200 && resp.statusCode !== 201) {
        const err = new errors.FailResponseError(resp);
        err.code = 'mercadopago_request_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          mercadopagoErrors: resp.data,
        };
        throw err;
      }

      paymentLog.debug('gateway.mercadopago.cancel_payment.request_succeed', {
        response: resp.data,
      });

      return {
        pending: false,
        cancelRequestReference: resp.data.id,
      };
    }).catch((err) => {
      paymentLog.info('gateway.mercadopago.cancel_payment.request_failed', {
        error: err,
      });
      throw err;
    });
}

function refundPayment(payment) {
  const paymentLog = log.child({
    client_reference: payment.get('client_reference'),
  });
  paymentLog.debug('gateway.mercadopago.refund_payment.starting_request');
  const postUrl = `/payments/${payment.get('gateway_reference')}/refunds`;

  return this.getClient()
    .post(postUrl, {})
    .then((resp) => {
      if (resp.statusCode !== 200 && resp.statusCode !== 201) {
        const err = new errors.FailResponseError(resp);
        err.code = 'mercadopago_request_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          mercadopagoErrors: resp.data,
        };
        throw err;
      }

      paymentLog.debug('gateway.mercadopago.refund_payment.request_succeed', {
        response: resp.data,
      });

      return {
        pending: false,
        cancelRequestReference: resp.data.id,
      };
    }).catch((err) => {
      paymentLog.info('gateway.mercadopago.refund_payment.request_failed', {
        error: err,
      });
      throw err;
    });
}

function shouldSkipIpn(payload) {
  const isMercadoagoIPN = payload.topic;
  const isMercadopagoWebhook = payload.type && payload.action;
  const webhookHasSupportedActionType = _.includes(SUPPORTED_WEBHOOK_ACTION_TYPES, payload.type);

  return isMercadoagoIPN || (isMercadopagoWebhook && !webhookHasSupportedActionType);
}

function parseIpnPayload(payload) {
  if (shouldSkipIpn(payload)) {
    return Promise.reject(new errors.SkipIpnError());
  }

  if (!_.get(payload, 'data.id')) {
    return Promise.reject(new errors.BadRequest('Webhook does not contain payment id'));
  }

  const client = this.getClient();
  return Promise.resolve()
    .then(() => client.get(`/payments/${payload.data.id}`))
    .then((resp) => {
      if (resp.statusCode !== 200 && resp.statusCode !== 201) {
        const err = new errors.FailResponseError(resp);
        err.code = 'mercadopago_webhook_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          mercadopagoErrors: resp.data,
        };
        throw err;
      }

      const payment = resp.data;

      log.debug('gateway.mercadopago.retrieve_ipn.success', {
        payment_id: payment.external_reference,
        response: resp,
      });

      if (!payment || !payment.external_reference || !payment.id || !payment.status || !payment.status_detail) {
        throw new errors.BadRequest('Invalid IPN schema');
      }

      // mercadopago sends one inp each time, we return an array for compatibility
      return [{
        client_reference: payment.external_reference,
        payloadJson: payment,
      }];
    })
    .catch((err) => {
      if (err.code && err.code === 'mercadopago_webhook_has_errors') {
        log.info('gateway.mercadopago.retrieve_ipn.non_200_response', {
          payment_id: payload.data.id,
          error: err.error,
        });
      } else {
        log.info('gateway.mercadopago.retrieve_ipn.request_failed', {
          payment_id: payload.data.id,
          error: err,
        });
      }

      throw err;
    });
}

function ipnSuccessResponse(res) {
  return res.status(200).end();
}

function capturePayment(payment) {
  const paymentLog = log.child({
    client_reference: payment.get('client_reference'),
  });
  paymentLog.debug('gateway.mercadopago.capture_payment.starting_request');
  const url = `/payments/${payment.get('gateway_reference')}`;

  return this.getClient()
    .put(url, {
      capture: true,
    })
    .then((resp) => {
      if (resp.statusCode !== 200 && resp.statusCode !== 201) {
        const err = new errors.FailResponseError(resp);
        err.code = 'mercadopago_request_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          mercadopagoErrors: resp.data,
        };
        throw err;
      }

      paymentLog.debug('gateway.mercadopago.capture_payment.request_succeed', {
        response: resp.data,
      });

      return {};
    }).catch((err) => {
      paymentLog.info('gateway.mercadopago.capture_payment.request_failed', {
        error: err,
      });
      throw err;
    });
}

function ipnFailResponse(res, err) {
  if (err.message === 'One or more ipns failed') {
    err.status = 500;
  }

  throw err;
}

function createPaymentData(payment, requestData, options) {
  const type = requestData.type;
  const notificationUrl = options.notificationUrl;


  return payment.getRelation('paymentOrder')
    .then((paymentOrder) => {
      const buyerPromise = paymentOrder.getRelation('buyer');
      const itemsPromise = paymentOrder.getRelation('items');
      return Promise.join(buyerPromise, itemsPromise, (buyer, items) => {
        const simpleAddress = {
          street_name: buyer.get('billing_street'),
          street_number: buyer.get('billing_number'),
          zip_code: buyer.get('billing_zip_code'),
        };

        const fullAddress = Object.assign({}, simpleAddress);
        _.assign(fullAddress, {
          neighborhood: buyer.get('billing_district'),
          city: buyer.get('billing_city'),
          federal_unit: buyer.get('billing_state_code'),
        });


        const body = {
          description: items.first() ? items.first().get('name') : DEFAULT_PAYMENT_DESCRIPTION,
          statement_descriptor: STATEMENT_DESCRIPTOR,
          external_reference: payment.get('client_reference'),
          binary_mode: false, // We will allow pending state in MercadoPago.
          transaction_amount: payment.get('total'),
          notification_url: notificationUrl,
          payer: {
            email: buyer.get('email'),
            identification: {
              type: buyer.get('document_type'),
              number: buyer.get('document_number'),
            },
            address: fullAddress,
          },
          additional_info: {
            items: items.map((item) => {
              return {
                title: item.get('name'),
                description: item.get('name'),
                category_id: PRODUCT_CATEGORY_ID,
                quantity: item.get('quantity'),
                unit_price: item.get('total'),
              };
            }),
            shipments: {
              receiver_address: {
                zip_code: buyer.get('shipping_zip_code'),
                street_number: buyer.get('shipping_number'),
                street_name: buyer.get('shipping_street'),
                floor: buyer.get('shipping_complement'), // complemento
                apartment: null,
              },
            },
            payer: {
              phone: {
                area_code: '',
                number: buyer.get('phone'),
              },
              address: simpleAddress,
            },
          },
        };

        if (buyer.get('type') === Buyer.PERSON_TYPE) {
          body.additional_info.payer.first_name = buyer.get('first_name');
          body.additional_info.payer.last_name = buyer.get('last_name');
          body.payer.first_name = buyer.get('first_name');
          body.payer.last_name = buyer.get('last_name');
          body.payer.entity_type = 'individual';
        } else {
          body.additional_info.payer.first_name = buyer.get('name');
          body.additional_info.payer.last_name = '';
          body.payer.first_name = buyer.get('name');
          body.payer.last_name = buyer.get('name');
          body.payer.entity_type = 'association';
        }

        if (type === PaymentTypes.creditCard) {
          const processor = payment.get('payment_information') ? payment.get('payment_information').processor : null;
          const mercadopagoPaymentMethodId = MERCADOPAGO_PROCESSORS_MAP[processor];
          const creditCardToken = helpers.getEncryptedToken(requestData, EncryptionType.mercadopago);
          const installments = requestData.installments;

          body.token = creditCardToken;
          body.installments = installments;
          body.payment_method_id = mercadopagoPaymentMethodId;
          body.capture = false; // We will not capture automatically the payment.
        }

        if (type === PaymentTypes.ticket) {
          body.payment_method_id = this.getKey('ticketPaymentMethodId');
        }

        return body;
      });
    });
}

function translateIpnStatus(ipnData, payment) {
  return this.doStatusTranslation(statusMap, ipnData.status).then((newStatus) => {
    if (newStatus === PaymentStatus.cancelled &&
            payment.get('status_id') === PaymentStatus.rejected) {
      log.info('gateway.mercadopago.received_cancel_ipn_for_rejected_payment', {
        client_reference: payment.get('client_reference'),
        gateway_reference: payment.get('gateway_reference'),
        payment_order_id: payment.get('payment_order_id'),
        payment_id: payment.get('id'),
      });
      return PaymentStatus.rejected;
    }
    return newStatus;
  });
}

function translateAuthorizeStatus(response, payment) {
  return this.doStatusTranslation(statusMap, response.data.status);
}

function translateAuthorizeStatusDetail(response, payment) {
  return this.doStatusTranslation(statusDetailsMap, response.data.status_detail);
}

function translateIpnStatusDetail(ipnData, payment) {
  return this.doStatusTranslation(statusDetailsMap, ipnData.status_detail);
}

function buildMetadata(response) {
  return {
    collectorId: response.data.collector_id,
    issuerId: response.data.issuer_id,
    authorizationCode: response.data.authorization_code,
    verification_code: _.get(response.data, 'transaction_details.verification_code', null),
  };
}

function buildPaymentInformation(resp, requestData) {
  let paymentInformation = requestData.paymentInformation || {};

  if (requestData.type === PaymentTypes.ticket) {
    paymentInformation = _.assign(paymentInformation, {
      barcode: {
        type: resp.data.barcode.type ? resp.data.barcode.type : 'plain',
        width: resp.data.barcode.width ? resp.data.barcode.width : null,
        height: resp.data.barcode.height ? resp.data.barcode.height : null,
        content: resp.data.barcode.content,
      },
      ticket_reference: resp.data.transaction_details.payment_method_reference_id,
      ticket_url: resp.data.transaction_details.external_resource_url,
    });
  }

  return paymentInformation;
}

const extractGatewayReference = response => response.data.id.toString();

module.exports = {
  type: 'MERCADOPAGO',
  statusMap,
  statusDetailsMap,
  createPayment,
  cancelPayment,
  refundPayment,
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
