const _ = require('lodash');
const errors = require('../../errors');
const Promise = require('bluebird');
const PaymentStatus = require('../constants/payment_status');
const PaymentStatusDetail = require('../constants/payment_status_detail');

const statusMap = {
  '04': PaymentStatus.successful,
  '02': PaymentStatus.pendingClientAction,
  '06': PaymentStatus.refunded,
  '07': PaymentStatus.pendingCancel,
  '08': PaymentStatus.rejected,
  '09': PaymentStatus.cancelled,
  10: PaymentStatus.cancelled,
};

const statusDetailsMap = {
  // TODO: Waiting for better statues detail.
  unknown: PaymentStatusDetail.unknown,
};

function cancelPayment(payment) {
  return Promise.rejected();
}

function capturePayment(payment) {
  return Promise.resolve();
}

function ipnSuccessResponse(res) {
  return res.status(200).end();
}

function translateAuthorizeStatus(response, payment) {
  return this.doStatusTranslation(statusMap, response.CSTATUS);
}

function ipnFailResponse(res, err) {
  if (err.message === 'One or more ipns failed') {
    err.status = 500;
  }

  throw err;
}

function getClient() {
  return Promise.resolve();
}

function getReferenceWithIndex(reference) {
  return `${reference}_1_1`;
}

function parseIpnPayload(payload) {
  return new Promise((resolve, reject) => {
    if (!payload) {
      reject(new errors.SkipIpnError());
    }

    if (!_.get(payload, 'IDTRCFONEPAYMENTORDER')) {
      reject(new errors.BadRequest('IPN does not contain payment id'));
    }

    resolve([{
      client_reference: getReferenceWithIndex(payload.IDTRCFONEPAYMENTORDER),
      payloadJson: payload,
    }]);
  });
}

function buildMetadata(response) {
  return {};
}

function translateIpnStatus(ipnData, payment) {
  return this.doStatusTranslation(statusMap, ipnData.CSTATUS).then((newStatus) => {
    return newStatus;
  });
}

function translateIpnStatusDetail(ipnData, payment) {
  const ipntatusDetail = PaymentStatusDetail.unknown; // ipnData.cStatusDescr
  return this.doStatusTranslation(statusDetailsMap, ipntatusDetail);
}

function createPaymentData(payment, requestData, options) {
  return Promise.resolve();
}

function createPayment(payment, requestData, options) {
  return Promise.resolve({
    id: null,
    CSTATUS: '02',
    CSTATUSDESCR: PaymentStatusDetail.unknown,
  });
}

function translateAuthorizeStatusDetail(response, payment) {
  response.CSTATUSDESCR = PaymentStatusDetail.unknown;
  return this.doStatusTranslation(statusDetailsMap, response.CSTATUSDESCR);
}

function buildPaymentInformation(resp, requestData) {
  return requestData.paymentInformation || {};
}

const extractGatewayReference = response => response.IDTRCFONEPAYMENTORDER;

module.exports = {
  type: 'TOTVS',
  statusMap,
  statusDetailsMap,
  createPayment,
  createPaymentData,
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
  buildMetadata,
  translateIpnStatusDetail,
  translateIpnStatus,
};
