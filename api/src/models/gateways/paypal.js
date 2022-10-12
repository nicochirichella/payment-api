const _ = require('lodash');
const moment = require('moment');
const ApiClient = require('../../services/api_client');
const config = require('../../config');
const errors = require('../../errors');
const Promise = require('bluebird');
const log = require('../../logger');
const helpers = require('../../lib/helpers');
const PaymentStatus = require('../constants/payment_status');
const PaymentStatusDetail = require('../constants/payment_status_detail');
const PaymentType = require('../constants/payment_type');
const tokenManager = require('../../services/token_manager');
const PaymentTypes = require('../constants/payment_type');
const Buyer = require('../constants/buyer_type');

const tokenManagerGatewayConfig = {
  tokenRefreshData: {
    method: 'POST',
    accessTokenResponsePath: 'access_token',
    expirationTimeResponsePath: 'expires_in',
    expirationTimeResponseType: 'countdown',
    expirationTimeResponseUnit: 'seconds',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en_US',
    },
    body: {
      grant_type: 'client_credentials',
    },
    type: 'form',
  },
};

tokenManager.addGatewayConfig('PAYPAL-paypal', tokenManagerGatewayConfig);
tokenManager.addGatewayConfig('PAYPAL-creditCard', tokenManagerGatewayConfig);

const statusMap = {
  created: PaymentStatus.pendingClientAction,
  authorized: PaymentStatus.authorized,
  voided: PaymentStatus.cancelled,
  completed: PaymentStatus.successful,
  approved: PaymentStatus.successful,
  pending: PaymentStatus.pendingAuthorize,
  denied: PaymentStatus.rejected,
  failed: PaymentStatus.rejected,
};

const ipnStatusMap = {
  'PAYMENT.SALE.COMPLETED': PaymentStatus.successful,
  'PAYMENT.SALE.DENIED': PaymentStatus.rejected,
  'PAYMENT.SALE.PENDING': PaymentStatus.pendingAuthorize,
  'PAYMENT.SALE.REFUNDED': PaymentStatus.refunded,
  'PAYMENT.SALE.REVERSED': PaymentStatus.chargedBack,
  'CUSTOMER.DISPUTE.CREATED': PaymentStatus.inMediation,
  'CUSTOMER.DISPUTE.UPDATED': PaymentStatus.inMediation,
  'CUSTOMER.DISPUTE.RESOLVED': PaymentStatus.successful,
};

const mediationEventTypes = ['CUSTOMER.DISPUTE.CREATED', 'CUSTOMER.DISPUTE.RESOLVED', 'CUSTOMER.DISPUTE.UPDATED'];

const statusDetailsMap = {
  TRANSACTION_REFUSED: PaymentStatusDetail.fraud,
  INSTRUMENT_DECLINED: PaymentStatusDetail.no_funds,
  INTERNAL_SERVICE_ERROR: PaymentStatusDetail.other,
  PAYEE_ACCOUNT_RESTRICTED: PaymentStatusDetail.fraud,
  PAYER_ACCOUNT_LOCKED_OR_CLOSED: PaymentStatusDetail.fraud,
  PAYER_ACCOUNT_RESTRICTED: PaymentStatusDetail.fraud,
  PAYER_CANNOT_PAY: PaymentStatusDetail.fraud,
  TRANSACTION_REFUSED_BY_PAYPAL_RISK: PaymentStatusDetail.fraud,
  CREDIT_CARD_REFUSED: PaymentStatusDetail.fraud,
  SOCKET_HANG_UP: PaymentStatusDetail.other,
  'socket hang up': PaymentStatusDetail.other,
  'connect ECONNREFUSED': PaymentStatusDetail.other,
  'connect ETIMEDOUT': PaymentStatusDetail.other,
  UNKNOWN_INTERNAL_ERROR: PaymentStatusDetail.other,
  fiWalletLifecycle_unknown_error: PaymentStatusDetail.other,
  'Failed to decrypt term info': PaymentStatusDetail.other,
  RESOURCE_NOT_FOUND: PaymentStatusDetail.other,
  INTERNAL_SERVER_ERROR: PaymentStatusDetail.other,
  RISK_N_DECLINE: PaymentStatusDetail.fraud,
  NO_VALID_FUNDING_SOURCE_OR_RISK_REFUSED: PaymentStatusDetail.fraud,
  TRY_ANOTHER_CARD: PaymentStatusDetail.fraud,
  NO_VALID_FUNDING_INSTRUMENT: PaymentStatusDetail.no_funds,
  CARD_ATTEMPT_INVALID: PaymentStatusDetail.max_attempts_reached,
  INVALID_OR_EXPIRED_TOKEN: PaymentStatusDetail.expired,
  CHECK_ENTRY: PaymentStatusDetail.wrong_card_data,
};


function getClient(paymentType) {
  return this.getToken(paymentType).then((token) => {
    return new ApiClient(this.get('base_url'), {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
  });
}

function getBaseKey(paymentType) {
  if (paymentType === PaymentType.paypal) {
    return 'walletSecrets.';
  } else if (paymentType === PaymentType.creditCard) {
    return 'ccSecrets.';
  }

  throw new errors.InternalServerError('Unexpected keyName', {
    paymentType,
    gateway: this.get('name'),
  });
}

function getMerchantId(paymentType) {
  return this.getKey(`${this.getBaseKey(paymentType)}merchantId`);
}

function getToken(paymentType) {
  let baseKey = null;
  try {
    baseKey = this.getBaseKey(paymentType);
  } catch (err) {
    return Promise.reject(err);
  }

  return tokenManager.getToken(`PAYPAL-${paymentType}`, {
    user: this.getKey(`${baseKey}clientId`),
    pass: this.getKey(`${baseKey}clientSecret`),
  }, this.getKey('refreshTokenUrl'));
}

function createPayment(payment, requestData, options) {
  return this.createPaymentData(payment, requestData, options)
    .then((payload) => {
      log.debug('gateway.paypal.create_payment.starting_request', {
        client_reference: payment.get('client_reference'),
        body: helpers.maskCreatePaymentRequest(payload),
      });

      return this.getClient(payment.get('type'))
        .then((client) => {
          return client.post('/payments/payment', payload);
        })
        .then((resp) => {
          if (resp.statusCode !== 200 && resp.statusCode !== 201) {
            const err = new errors.FailResponseError(resp);
            err.code = 'paypal_request_has_errors';
            err.status = 400;
            err.context = {
              statusCode: resp.statusCode,
              paypalErrors: resp.data,
            };
            throw err;
          }

          log.debug('gateway.paypal.create_payment.request_succeed', {
            client_reference: payment.get('client_reference'),
            response: resp.data,
          });

          return resp;
        }).then((creationResponse) => {
          const gatewayReference = this.extractGatewayReference(creationResponse);
          return this.sendAntiFraudData(payment, gatewayReference)
            .then(() => creationResponse);
        })
        .catch((err) => {
          if (err.code && err.code === 'paypal_request_has_errors') {
            log.info('gateway.paypal.create_payment.non_200_response', {
              client_reference: payment.get('client_reference'),
              error: err.error,
            });
          } else {
            log.info('gateway.paypal.create_payment.request_failed', {
              client_reference: payment.get('client_reference'),
              error: err,
            });
          }

          throw err;
        });
    });
}

function sendAntiFraudData(payment, gatewayReference) {
  // This post is required by paypal BEFORE executing the payment to perform fraud analysis on the payment
  const paymentLog = log.child({
    client_reference: gatewayReference,
  });


  return payment.getRelation('paymentOrder')
    .then((paymentOrder) => {
      const buyerPromise = paymentOrder.getRelation('buyer');
      const itemsPromise = paymentOrder.getRelation('items');
      return Promise.join(buyerPromise, itemsPromise, (buyer, items) => {
        const postUrl = `/risk/transaction-contexts/${this.getMerchantId(payment.get('type'))}/${gatewayReference}`;

        const antiFraudData = {
          sender_account_id: paymentOrder.get('purchase_reference'),
          sender_first_name: buyer.get('first_name'),
          sender_last_name: buyer.get('last_name'),
          sender_email: buyer.get('email'),
          sender_phone: buyer.get('phone'),
          sender_country_code: 'BR',
          sender_address_state: buyer.get('billing_state_code'),
          sender_address_city: buyer.get('billing_city'),
          sender_address_zip: buyer.get('billing_zip_code'),
          sender_address_line1: `${buyer.get('billing_street')} ${buyer.get('billing_number')}`,
          sender_address_line2: (`${buyer.get('billing_district')} ${buyer.get('billing_complement')}`).substring(0, 99),
          sender_create_date: moment().format('DD/MM/YYYY'),
          sender_signup_ip: buyer.get('ip_address'),
          cd_string_one: items.first().get('name'),
        };

        const antiFraudBody = {
          additional_data: _.compact(_.map(antiFraudData, (value, key) => {
            if (value) {
              return { key, value };
            }
            return null;
          })),
        };

        paymentLog.info('gateway.paypal.execute_payment.anti_fraud_data.starting_request', {
          postUrl,
          body: antiFraudBody,
          gateway_reference: gatewayReference,
        });

        return this.getClient(payment.get('type'))
          .then((client) => {
            return client.put(postUrl, antiFraudBody, {
              'PayPal-Client-Metadata-Id': gatewayReference,
            });
          });
      });
    }).then((resp) => {
      paymentLog.info('gateway.paypal.execute_payment.anti_fraud_data.response', {
        response: resp,
        status: resp.statusCode,
        data: resp.data,
        gateway_reference: gatewayReference,
      });

      if (resp.statusCode !== 200 && resp.statusCode !== 201) {
        const err = new errors.FailResponseError(resp);
        err.code = 'paypal_request_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          paypalErrors: resp.data,
        };
        throw err;
      }

      paymentLog.debug('gateway.paypal.execute_payment.anti_fraud_data.request_success', {
        response_status: resp.statusCode,
        gateway_reference: gatewayReference,
      });
    })
    .catch((err) => {
      paymentLog.error('gateway.paypal.execute_payment.anti_fraud_data.request_failed', {
        err,
        client_reference: payment.get('client_reference'),
        gateway_reference: gatewayReference,
      });
      // Resuming payment execution. Since the fraud data post failed, the payment
      // will probably be rejected by paypal, but there's no harm in trying.
    });
}

function getInstallments(payment) {
  const postUrl = `/payments/payment/${payment.get('gateway_reference')}`;

  if (payment.get('installments') !== null) {
    return Promise.resolve(payment.get('installments'));
  }

  return this.getClient(payment.get('type'))
    .then((client) => {
      return client.get(postUrl);
    })
    .then((response) => {
      log.info('gateway.paypal.execute_payment.get_installments.response', {
        response: response.body,
        status: response.statusCode,
        gateway_reference: payment.get('gateway_reference'),
      });

      const installments = _.get(response, 'body.credit_financing_offered.term');
      if (installments) {
        log.info('gateway.paypal.execute_payment.get_installments.extracted_installments', {
          gateway_reference: payment.get('gateway_reference'),
          installments,
        });
        return installments;
      }
      log.error('gateway.paypal.execute_payment.get_installments.installments_not_found', {
        gateway_reference: payment.get('gateway_reference'),
      });
      return null;
    })
    .catch((err) => {
      log.error('gateway.paypal.execute_payment.get_installments.request_had_errors', {
        gateway_reference: payment.get('gateway_reference'),
        error: err,
      });
    });
}

function executePayment(payment, metadata) {
  const paymentLog = log.child({
    client_reference: payment.get('client_reference'),
  });

  paymentLog.debug('gateway.paypal.execute.starting_request');
  const postUrl = `/payments/payment/${payment.get('gateway_reference')}/execute`;

  return this.getInstallments(payment).then((installments) => {
    return this.getClient(payment.get('type'))
      .then((client) => {
        return client.post(postUrl, {
          payer_id: metadata.payerId,
        }, {
          'PayPal-Client-Metadata-Id': payment.get('gateway_reference'),
          // Useful! Add this header with the desired application error code to mock an error!
          // "PayPal-Mock-Response": "{\"mock_application_codes\":\"INSTRUMENT_DECLINED\"}"
        });
      })
      .tap((resp) => {
        paymentLog.info('gateway.paypal.execute_payment.response', {
          response: resp,
          status: resp.statusCode,
          data: resp.data,
          gateway_reference: payment.get('gateway_reference'),
          metadata,
        });
      })
      .then((resp) => {
        if (_.contains([200, 201], resp.statusCode)) {
          // Successful execution

          paymentLog.debug('gateway.paypal.execute_payment.request_succeed', {
            response: resp.data,
          });

          return this.translateAuthorizeStatus(resp, payment, 'data.transactions[0].related_resources[0].sale.state').then((status) => {
            return {
              pending: false,
              saleId: _.get(resp.data, 'transactions[0].related_resources[0].sale.id'),
              status,
              statusDetail: PaymentStatusDetail.ok,
              installments,
            };
          });
        } else if (resp.statusCode >= 400 && resp.statusCode < 500) {
          return this.translateAuthorizeStatusDetail(resp, payment).then((statusDetail) => {
            return {
              pending: false,
              saleId: null,
              status: PaymentStatus.rejected,
              statusDetail,
              installments,
            };
          }).catch(() => {
            return {
              pending: false,
              saleId: null,
              status: PaymentStatus.rejected,
              statusDetail: PaymentStatusDetail.unknown,
              installments,
            };
          });
        }

        // Retriable error

        paymentLog.error('gateway.paypal.execute_payment.internal_server_error', {
          response: resp,
          status: resp.statusCode,
          data: resp.data,
          gateway_reference: payment.get('gateway_reference'),
          metadata,
        });
        const err = new errors.FailResponseError(resp);
        err.code = 'paypal_request_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          paypalErrors: resp.data,
          metadata,
        };
        throw err;
      })
      .catch((err) => {
        paymentLog.info('gateway.paypal.execute_payment.request_failed', {
          error: err,
          gateway_reference: payment.get('gateway_reference'),
          metadata,
        });
        throw err;
      });
  });
}

function refundPayment(payment) {
  const paymentLog = log.child({
    client_reference: payment.get('client_reference'),
  });

  paymentLog.debug('gateway.paypal.refund.starting_request');
  const postUrl = `/payments/sale/${payment.get('metadata').saleId}/refund`;

  return this.getClient(payment.get('type'))
    .then((client) => {
      return client.post(postUrl, {});
    })
    .then((resp) => {
      if (resp.statusCode !== 200 && resp.statusCode !== 201) {
        const err = new errors.FailResponseError(resp);
        err.code = 'paypal_request_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          paypalErrors: resp.data,
        };
        throw err;
      }

      paymentLog.debug('gateway.paypal.refund_payment.request_succeed', {
        response: resp.data,
      });

      return {
        pending: false,
      };
    }).catch((err) => {
      paymentLog.info('gateway.paypal.cancel_payment.request_failed', {
        error: err,
      });
      throw err;
    });
}

function cancelPayment(payment) {
  return Promise.resolve(payment);
}

function parseIpnPayload(payload, queryParams) {

  if (!queryParams.type || !_.include(PaymentType.all, queryParams.type)) {
    return Promise.reject(new errors.BadRequest('Query param type missing or not valid'));
  }

  if (_.get(payload, 'event_type') === 'RISK.DISPUTE.CREATED') {
    return Promise.reject(new errors.SkipIpnError());
  }

  if (_.contains(mediationEventTypes, (_.get(payload, 'event_type')))) {
    const clientReference = _.get(payload, 'resource.disputed_transactions[0].invoice_number');

    if (!clientReference) {
      return Promise.reject(new errors.BadRequest('Dispute webhook does not contain client_reference'));
    }
    return Promise.resolve([{
      client_reference: _.get(payload, 'resource.disputed_transactions[0].invoice_number'),
      payloadJson: {
        ipnPayload: payload,
      },
    }]);
  }

  if (!_.get(payload, 'resource.parent_payment')) {
    return Promise.reject(new errors.BadRequest('Webhook does not contain payment id'));
  }

  const clientReferenceFromIpn = _.get(payload, 'resource.custom');


  return this.getClient(queryParams.type)
    .then(client => client.get(`/payments/payment/${payload.resource.parent_payment}`))
    .then((resp) => {
      if (resp.statusCode !== 200 && resp.statusCode !== 201) {
        const err = new errors.FailResponseError(resp);
        err.code = 'paypal_webhook_has_errors';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          paypalErrors: resp.data,
        };
        throw err;
      }

      const payment = resp.data;

      log.debug('gateway.paypal.retrieve_ipn.success', {
        payment_id: _.get(payment, 'transactions[0].custom'),
        response: resp,
      });

      const hasNoTransactionsOrPayment = !payment || !payment.transactions || !_.get(payment, 'transactions[0]');
      if (hasNoTransactionsOrPayment || !payment.id || !payment.state) {
        throw new errors.BadRequest('Invalid IPN schema');
      }

      const clientReferenceFromRequest = _.get(payment, 'transactions[0].custom');

      // paypal sends one ipn each time, we return an array for compatibility
      return [{
        client_reference: clientReferenceFromRequest ? clientReferenceFromRequest : clientReferenceFromIpn,
        payloadJson: {
          ipnPayload: payload,
        },
      }];
    })
    .catch((err) => {
      if (err.code && err.code === 'paypal_webhook_has_errors') {
        log.info('gateway.paypal.retrieve_ipn.non_200_response', {
          payment_id: payload.id,
          error: err.error,
        });
      } else {
        log.info('gateway.paypal.retrieve_ipn.request_failed', {
          payment_id: payload.id,
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
  // No capture
}

function ipnFailResponse(res, err) {
  if (err.message === 'One or more ipns failed') {
    err.status = 500;
  }
  throw err;
}

function createPaymentData(payment, requestData, options) {
  return payment.getRelation('paymentOrder')
    .then((paymentOrder) => {
      const buyerPromise = paymentOrder.getRelation('buyer');
      const itemsPromise = paymentOrder.getRelation('items');
      return Promise.join(buyerPromise, itemsPromise, (buyer, items) => {
        const total = payment.get('total');
        const birthDate = buyer.get('birth_date');
        const body = {
          payer: {
            payer_info: {
              birth_date: birthDate ? moment(birthDate).format('YYYY-MM-DD') : '1990-01-01', // TODO:solucionar este hardcode
              tax_id: buyer.get('document_number'),
              tax_id_type: `BR_${buyer.get('document_type').toUpperCase()}`,
              email: buyer.get('email'),
              billing_address: {
                city: buyer.get('billing_city'),
                country_code: 'BR',
                line1: `${buyer.get('billing_street')} ${buyer.get('billing_number')}`,
                line2: (`${buyer.get('billing_district')} ${buyer.get('billing_complement')}`).substring(0, 99),
                phone: buyer.get('phone'),
                postal_code: buyer.get('billing_zip_code'),
                state: buyer.get('billing_state'),
                type: 'HOME_OR_WORK',
              },
            },
            payment_method: 'paypal',
          },
          note_to_payer: 'Obrigado por sua compra.',
          intent: 'sale',
          redirect_urls: {
            return_url: `${this.getKey('checkoutUrl')}/execute?hash=${paymentOrder.get('purchase_reference')}`,
            cancel_url: paymentOrder.get('metadata').cancelUrl,
          },
          application_context: {
            shipping_preference: 'SET_PROVIDED_ADDRESS',
          },
          transactions: [
            {
              amount: {
                currency: payment.get('currency'),
                details: {
                  subtotal: total,
                },
                total,
              },
              invoice_number: payment.get('client_reference'),
              reference_id: payment.get('client_reference'),
              custom: payment.get('client_reference'),
              item_list: {
                items: items.map((item) => {
                  return {
                    currency: payment.get('currency'),
                    description: item.get('name'),
                    name: item.get('name'),
                    price: total,
                    quantity: item.get('quantity'),
                  };
                }),
                shipping_address: {
                  city: buyer.get('shipping_city'),
                  country_code: 'BR',
                  line1: `${buyer.get('shipping_street')} ${buyer.get('shipping_number')}`,
                  line2: (`${buyer.get('shipping_district')} ${buyer.get('shipping_complement')}`).substring(0, 99),
                  phone: buyer.get('phone'),
                  postal_code: buyer.get('shipping_zip_code'),
                  state: buyer.get('shipping_state'),
                },
              },
              payment_options: {
                allowed_payment_method: 'INSTANT_FUNDING_SOURCE',
              },
            },
          ],
        };

        if (buyer.get('type') === Buyer.PERSON_TYPE) {
          body.payer.payer_info.first_name = buyer.get('first_name');
          body.payer.payer_info.last_name = buyer.get('last_name');
        } else {
          body.payer.payer_info.first_name = buyer.get('name');
          body.payer.payer_info.last_name = '';
        }

        return body;
      });
    });
}

function translateIpnStatus(ipnData, payment) {

  return this.doStatusTranslation(ipnStatusMap, ipnData.ipnPayload.event_type)
    .then((status) => {
      return payment.history()
        .then((h) => {
          const eventType = ipnData.ipnPayload.event_type;
          const isMediationIpn = _.contains(mediationEventTypes, ipnData.ipnPayload.event_type);
          const isResolvedMediationIpn = eventType === 'CUSTOMER.DISPUTE.RESOLVED';
          const currentStatus = payment.get('status_id');
          const canIgnoreMediation = _.intersection(h, [
            PaymentStatus.cancelled,
            PaymentStatus.chargedBack,
            PaymentStatus.rejected,
            PaymentStatus.refunded]).length >= 1;
          const wasPaymentEverSuccessful = _.includes(h, PaymentStatus.successful);

          if (isMediationIpn) {
            if (canIgnoreMediation) {
              // Trocafone doesn't have the money: mediation is pointless;
              return currentStatus;
            } else {
              if (wasPaymentEverSuccessful) {
                // Consider the mediation change
                return status;
              } else {
                if (currentStatus === PaymentStatus.inMediation && isResolvedMediationIpn) {
                  // Payment is still pending approval, ignoring and returning to previous status
                  log.error('gateways.paypal.translate_ipn_status.mediation_arrived_to_pending_payment');
                  return h[h.length - 2];
                } else {
                  return currentStatus;
                }
              }
            }
          }

          // Because we always refund payments, we have
          // to check in the payment history weather it's really
          // refunded or it was cancelled/rejected.
          if (status === PaymentStatus.refunded) {
            if (_.includes(h, PaymentStatus.successful)) {
              return PaymentStatus.refunded;
            }
            if (_.intersection(h, [PaymentStatus.pendingCancel, PaymentStatus.cancelled]).length >= 1) {
              return PaymentStatus.cancelled;
            }
            return PaymentStatus.rejected;
          }

          return status;

        })
    });
}

function translateAuthorizeStatus(response, payment, responsePath) {
  let status = null;
  if (responsePath && _.get(response, responsePath)) {
    status = _.get(response, responsePath);
  } else {
    status = _.get(response, 'data.state');
  }

  return this.doStatusTranslation(statusMap, status);
}

function translateAuthorizeStatusDetail(response, payment) {
  if (response.statusCode !== 200 && response.statusCode !== 201) {
    return this.doStatusTranslation(statusDetailsMap, _.get(response, 'data.name'));
  }
  return Promise.resolve(PaymentStatusDetail.ok);
}

function translateIpnStatusDetail(ipnData, payment) {
  // There is nothing in the response we can consider as a valid statusDetail :(
  return Promise.resolve(payment.get('status_detail'));
}

function buildMetadata(response, requestData) {
  return null;
}

function extractRedirectUrl(response, requestData, payment) {
  let approvalUrl = null;

  const links = _.get(response, 'body.links');
  approvalUrl = _.get(_.find(links, { rel: 'approval_url' }), 'href');

  if (!links || !approvalUrl) {
    log.error('gateways.paypal.unable_to_find_redirect_url', {
      client_reference: payment.get('client_reference'),
      payment_id: payment.get('id'),
      response,
    });
    return Promise.reject(new Error('Could not find the approval url in the gateway response.'));
  }

  if (payment.get('type') === PaymentTypes.paypal) {
    return Promise.resolve(approvalUrl);
  }
  return payment.getRelation('paymentOrder').then((po) => {
    const buyerPromise = po.getRelation('buyer');
    const tenantPromise = po.getRelation('tenant');
    const itemsPromise = po.getRelation('items');
    return Promise.join(buyerPromise, tenantPromise, itemsPromise, (buyer, tenant, items) => {
      let baseRedirectUrl = `${config.get('front.baseUrl')}/${config.get('front.paypalRedirectUri')}`;
      const payerData = _.get(response.body, 'payer.payer_info');
      const queryParams = {
        approvalUrl: encodeURIComponent(_.find(response.body.links, { rel: 'approval_url' }).href),
        payerFirstName: payerData.first_name,
        payerLastName: payerData.last_name,
        payerEmail: payerData.email,
        payerPhone: buyer.get('phone'),
        payerTaxId: payerData.tax_id,
        payerTaxIdType: payerData.tax_id_type,
        country: 'BR',
        language: 'pt_BR',
        paymentId: response.body.id,
        environment: config.get('env'),
        installments: payment.get('installments'),
        purchaseReference: po.get('purchase_reference'),
        clientReference: payment.get('client_reference'),
        tenant: tenant.get('name'),
        itemName: encodeURIComponent(items.first().get('name')),
        itemImageUrl: encodeURIComponent(items.first().get('image_url')),
        total: po.get('total'),
      };
      baseRedirectUrl += '?';
      _.forEach(queryParams, (value, name) => {
        baseRedirectUrl += `${name}=${value}&`;
      });
      return Promise.resolve(baseRedirectUrl.slice(0, -1));
    });
  });
}

function buildPaymentInformation(resp, requestData) {
  const paymentInformation = requestData.paymentInformation || {};
  return paymentInformation;
}

const extractGatewayReference = response => response.data.id.toString();

module.exports = {
  type: 'PAYPAL',
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
  extractRedirectUrl,
  getToken,
  executePayment,
  sendAntiFraudData,
  getMerchantId,
  getBaseKey,
  getInstallments,
};
