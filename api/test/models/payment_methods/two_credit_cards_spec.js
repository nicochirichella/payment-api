'use strict';

const _ = require('lodash');
const sinon = require('sinon');
const expect = require('chai').expect;
const PaymentOrder = require('../../../src/models/payment_order');
const PaymentStatus = require('../../../src/models/constants/payment_status');
const PaymentMethod = require('../../../src/models/payment_method');
const GatewayMethod = require('../../../src/models/gateway_method');
const TwoCreditCards = require('../../../src/models/payment_methods/two_credit_cards');
const Promise = require('bluebird');
const knex = require('../../../src/bookshelf').knex;

describe('PaymentMethod :: Two Credit Cards', () => {
  let paymentMethod,
    gatewayMethod;
  let paymentOrder;

  beforeEach(() => {
    paymentMethod = new PaymentMethod({ gateway_method_id: 1 });
    _.extend(paymentMethod, TwoCreditCards);

    return knex('gateway_methods')
      .insert({
        id: 1,
        tenant_id: 1,
        type: 'MERCADOPAGO_CC',
        name: 'MethodA',
        enabled: true,
      })
      .then(() => GatewayMethod.forge({ id: 1 }).fetch())
      .then((gm) => {
        paymentMethod.relations.gatewayMethod = gm;
        gatewayMethod = gm;
      });
  });

  describe('#validatePayments', () => {
    const payment1 = {
      installments: 6,
      amountInCents: 60000,
      type: 'creditCard',
      paymentInformation: {
        processor: 'visa',
        lastFourDigits: 1234,
        firstSixDigits: 123456,
      },
      encryptedCreditCards: [{
        encryptedContent: '{{credit_card_token}}',
        encryptionType: 'mercadopagoToken',
      }],
    };
    const payment2 = {
      installments: 6,
      amountInCents: 60000,
      type: 'creditCard',
      paymentInformation: {
        processor: 'visa',
        lastFourDigits: 1234,
        firstSixDigits: 123456,
      },
      encryptedCreditCards: [{
        encryptedContent: '{{credit_card_token}}',
        encryptionType: 'mercadopagoToken',
      }],
    };

    const zeroPaymentData = [];
    const onePaymentData = [payment1];
    const twoPaymentData = [payment1, payment2];

    it('should return success when payments type and quantity are ok', () => {
      return expect(paymentMethod.validatePayments(twoPaymentData, 1))
        .to.be.fulfilled;
    });

    it('should return fail when payments type is ok and quantity is zero', () => {
      return expect(paymentMethod.validatePayments(zeroPaymentData, 1))
        .to.be.rejectedWith('twoCreditCards needs exactly two payments');
    });

    it('should return fail when payments type is ok and quantity is one', () => {
      return expect(paymentMethod.validatePayments(onePaymentData, 1))
        .to.be.rejectedWith('twoCreditCards needs exactly two payments');
    });

    it('should return fail when payments type fail', () => {
      twoPaymentData[0].type = 'ticket';
      return expect(paymentMethod.validatePayments(twoPaymentData, 1))
        .to.be.rejectedWith('twoCreditCard acepts only creditCard type');
    });
  });

  describe('#calculateStatus', () => {
    const paymentOrderId = 20;
    const testData = [
      // initial
      {
        payments: [PaymentStatus.creating, PaymentStatus.creating],
        result: PaymentStatus.creating,
      },
      {
        payments: [PaymentStatus.pendingAuthorize, PaymentStatus.pendingAuthorize],
        result: PaymentStatus.pendingAuthorize,
      },
      // creation succeeds
      {
        payments: [PaymentStatus.authorized, PaymentStatus.authorized],
        result: PaymentStatus.authorized,
      },
      // error (mixed)
      {
        payments: [PaymentStatus.error, PaymentStatus.authorized],
        result: PaymentStatus.error,
      },
      {
        payments: [PaymentStatus.rejected, PaymentStatus.authorized],
        result: PaymentStatus.rejected,
      },
      {
        payments: [PaymentStatus.pendingAuthorize, PaymentStatus.error],
        result: PaymentStatus.error,
      },
      {
        payments: [PaymentStatus.pendingAuthorize, PaymentStatus.rejected],
        result: PaymentStatus.rejected,
      },
      // pending
      {
        payments: [PaymentStatus.authorized, PaymentStatus.pendingAuthorize],
        result: PaymentStatus.pendingAuthorize,
      },
      {
        payments: [PaymentStatus.pendingAuthorize, PaymentStatus.pendingAuthorize],
        result: PaymentStatus.pendingAuthorize,
      },
      // pending cancel
      {
        payments: [PaymentStatus.error, PaymentStatus.pendingCancel],
        result: PaymentStatus.error,
      },
      {
        payments: [PaymentStatus.rejected, PaymentStatus.pendingCancel],
        result: PaymentStatus.rejected,
      },
      {
        payments: [PaymentStatus.pendingCancel, PaymentStatus.pendingCancel],
        result: PaymentStatus.pendingCancel,
      },
      {
        payments: [PaymentStatus.pendingCancel, PaymentStatus.authorized],
        result: PaymentStatus.pendingCancel,
      },
      {
        payments: [PaymentStatus.pendingCancel, PaymentStatus.pendingAuthorize],
        result: PaymentStatus.pendingCancel,
      },
      {
        payments: [PaymentStatus.pendingCancel, PaymentStatus.pendingCapture],
        result: PaymentStatus.pendingCancel,
      },
      {
        payments: [PaymentStatus.pendingCancel, PaymentStatus.cancelled],
        result: PaymentStatus.pendingCancel,
      },
      // cancelled
      {
        payments: [PaymentStatus.error, PaymentStatus.cancelled],
        result: PaymentStatus.error,
      },
      {
        payments: [PaymentStatus.rejected, PaymentStatus.cancelled],
        result: PaymentStatus.rejected,
      },
      // Cancellations by client that could be done in mercadopago
      {
        payments: [PaymentStatus.pendingAuthorize, PaymentStatus.cancelled],
        result: PaymentStatus.cancelled,
      },
      {
        payments: [PaymentStatus.authorized, PaymentStatus.cancelled],
        result: PaymentStatus.cancelled,
      },
      {
        payments: [PaymentStatus.pendingCapture, PaymentStatus.cancelled],
        result: PaymentStatus.cancelled,
      },
      {
        payments: [PaymentStatus.successful, PaymentStatus.cancelled],
        result: PaymentStatus.cancelled,
      },
      // total success
      {
        payments: [PaymentStatus.successful, PaymentStatus.successful],
        result: PaymentStatus.successful,
      },
      {
        payments: [PaymentStatus.successful, PaymentStatus.pendingCapture],
        result: PaymentStatus.pendingCapture,
      },
      {
        payments: [PaymentStatus.pendingCapture, PaymentStatus.pendingCapture],
        result: PaymentStatus.pendingCapture,
      },
      // refund
      {
        payments: [PaymentStatus.refunded, PaymentStatus.refunded],
        result: PaymentStatus.refunded,
      },
      // charge-back
      {
        payments: [PaymentStatus.chargedBack, PaymentStatus.successful],
        result: PaymentStatus.chargedBack,
      },
      // in mediation
      {
        payments: [PaymentStatus.inMediation, PaymentStatus.successful],
        result: PaymentStatus.inMediation,
      },
      {
        payments: [PaymentStatus.inMediation, PaymentStatus.inMediation],
        result: PaymentStatus.inMediation,
      },
    ];

    _.forEach(testData, (data) => {
      it(`should resolve the statuses: [${data.payments.join(', ')}] to:${data.result}`, () => {
        const paymentPromise = Promise.map(data.payments, (status) => {
          return knex('payments').insert([{
            status_id: PaymentStatus.error,
            payment_order_id: paymentOrderId,
            retried_with_payment_id: 2,
          },
          {
            status_id: status,
            payment_order_id: paymentOrderId,
          },
          ]);
        });
        const paymentOrder = PaymentOrder.forge({ id: paymentOrderId });

        return expect(paymentPromise.then(() => paymentMethod.calculateStatus(paymentOrder)))
          .to.eventually.be.equal(data.result);
      });
    });

    it('should return creating if it has no payments', () => {
      paymentOrder = PaymentOrder.forge({ id: 1 });

      return expect(paymentMethod.calculateStatus(paymentOrder))
        .to.eventually.be.equal(PaymentStatus.creating);
    });
  });
});

function resolve(value) {
  return new Promise(((res, rej) => {
    process.nextTick(() => {
      res(value);
    });
  }));
}

function reject(error) {
  return new Promise(((res, rej) => {
    process.nextTick(() => {
      rej(error);
    });
  }));
}
