'use strict';

const _ = require('lodash');
const sinon = require('sinon');
const expect = require('chai').expect;
const PaymentOrder = require('../../../src/models/payment_order');
const PaymentStatus = require('../../../src/models/constants/payment_status');
const PaymentMethod = require('../../../src/models/payment_method');
const GatewayMethod = require('../../../src/models/gateway_method');
const OneCreditCard = require('../../../src/models/payment_methods/one_credit_card');
const Promise = require('bluebird');
const knex = require('../../../src/bookshelf').knex;

describe('PaymentMethod :: One Credit Card', () => {
  let paymentMethod;
  let gatewayMethod;
  let paymentOrder;

  beforeEach(() => {
    paymentMethod = new PaymentMethod({ gateway_method_id: 1 });
    _.extend(paymentMethod, OneCreditCard);

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
      installments: 1,
      amountInCents: 1000,
      type: 'ticket',
      paymentInformation: {},
    };
    const zeroPaymentData = [];
    const onePaymentData = [payment1];
    const twoPaymentData = [payment1, payment2];

    it('should return success when payments type and quantity are ok', () => {
      return expect(paymentMethod.validatePayments(onePaymentData, 1))
        .to.be.fulfilled;
    });

    it('should return fail when payments type is ok and quantity is zero', () => {
      return expect(paymentMethod.validatePayments(zeroPaymentData, 1))
        .to.be.rejectedWith('oneCreditCard only accepts one payment');
    });

    it('should return fail when payments type is ok and quantity is two', () => {
      return expect(paymentMethod.validatePayments(twoPaymentData, 1))
        .to.be.rejectedWith('oneCreditCard only accepts one payment');
    });

    it('should return fail when payments type fail', () => {
      onePaymentData[0].type = 'ticket';
      return expect(paymentMethod.validatePayments(onePaymentData, 1))
        .to.be.rejectedWith('oneCreditCard acepts only creditCard type');
    });
  });

  describe('#calculateStatus', () => {
    const paymentOrderId = 20;
    const testData = [
      {
        payment: PaymentStatus.successful,
        result: PaymentStatus.successful,
      },
      {
        payment: PaymentStatus.rejected,
        result: PaymentStatus.rejected,
      },
      {
        payment: PaymentStatus.chargedBack,
        result: PaymentStatus.chargedBack,
      },
      {
        payment: PaymentStatus.pendingCapture,
        result: PaymentStatus.pendingCapture,
      },
      {
        payment: PaymentStatus.refunded,
        result: PaymentStatus.refunded,
      },
      {
        payment: PaymentStatus.cancelled,
        result: PaymentStatus.cancelled,
      },
      {
        payment: PaymentStatus.partialRefund,
        result: PaymentStatus.partialRefund,
      },
      {
        payment: PaymentStatus.inMediation,
        result: PaymentStatus.inMediation,
      },
      {
        payment: PaymentStatus.pendingCancel,
        result: PaymentStatus.pendingCancel,
      },
      {
        payment: PaymentStatus.pendingAuthorize,
        result: PaymentStatus.pendingAuthorize,
      },
      {
        payment: PaymentStatus.authorized,
        result: PaymentStatus.authorized,
      },
      {
        payment: PaymentStatus.creating,
        result: PaymentStatus.creating,
      },
      {
        payment: PaymentStatus.error,
        result: PaymentStatus.error,
      },
      {
        payment: PaymentStatus.pendingClientAction,
        result: PaymentStatus.pendingClientAction,
      },
    ];

    _.forEach(testData, (data) => {
      it(`should resolve the status: ${data.payment} to:${data.result}`, () => {
        const paymentPromise = knex('payments').insert(
          [{
            status_id: PaymentStatus.error,
            payment_order_id: paymentOrderId,
            retried_with_payment_id: 2,
          },
          {
            status_id: data.payment,
            payment_order_id: paymentOrderId,
          },
          ]);


        paymentOrder = PaymentOrder.forge({ id: paymentOrderId });

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
