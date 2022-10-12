const PaymentStatusDetail = require('../constants/payment_status_detail');
const PaymentStatus = require('../constants/payment_status');
const _ = require('lodash');

const SHOULD_NOT_RETRY_IN_CASES = [
  PaymentStatusDetail.no_funds,
  PaymentStatusDetail.decline_card];

function shouldRetry(response) {
  if (response.status === PaymentStatus.rejected) {
    return !_.includes(SHOULD_NOT_RETRY_IN_CASES, response.statusDetail);
  }
  return false;
}

module.exports = {
  shouldRetry,
};
