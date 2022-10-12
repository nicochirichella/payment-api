const assert = require('chai').assert;
const _ = require('lodash');
const cybersourceRetrier = require('../../../src/models/payment_retriers/cybersource_retrier');
const PaymentStatus = require('../../../src/models/constants/payment_status');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');

describe('#cybersource_retrier', () => {
  describe('shouldRetry', () => {
    const testDataShouldRetryMustBeFalse = [
      {
        status: PaymentStatus.authorized,
        statusDetail: 'no_matter_the_status_detail_must_be_false',
      },
      {
        status: PaymentStatus.pendingAuthorize,
        statusDetail: 'no_matter_the_status_detail_must_be_false',
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.no_funds,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.decline_card,
      },
    ];

    _.forEach(testDataShouldRetryMustBeFalse, (data) => {
      it(`should retry must be false for the status: ${data.status} and status detail: ${data.statusDetail}`, () => {
        return assert.isFalse(cybersourceRetrier.shouldRetry(data));
      });
    });

    const testDataShouldRetryMustBeTrue = [
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.invalid_account_number,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.wrong_card_data,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.other,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.duplicated_payment,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.unknown,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.timeout,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.account_not_enabled,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.call_for_authorize,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.expired,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.stolen_or_lost_card,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.rejected_by_bank,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.card_type_not_accepted,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.gateway_error,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.automatic_fraud,
      },
      {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.manual_review,
      },
    ];

    _.forEach(testDataShouldRetryMustBeTrue, (data) => {
      it(`should retry must be true for the status: ${data.status} and status detail: ${data.statusDetail}`, () => {
        return assert.isTrue(cybersourceRetrier.shouldRetry(data));
      });
    });

  });
});
