'use strict';

const expect = require('chai').expect;

describe('#Views', () => {

  const paymentView = require('../../src/views/payments');
  const Payment = require('../../src/models/payment');
  const Item = require('../../src/models/item');
  const Buyer = require('../../src/models/buyer');
  const GatewayMethod = require('../../src/models/gateway_method');

  describe('Payment', () => {
    beforeEach(function () {
      const payment = new Payment(require('../fixtures/models/payment_fixture.json'));
      const item = new Item(require('../fixtures/models/item_iphone_fixture.json'));
      const buyer = new Buyer(require('../fixtures/models/person_buyer_fixture.json'));
      const gatewayMethod = new GatewayMethod({
        id: 10,
        type: 'GATEWAY_METHOD_TEST',
      });

      payment.relations.items = [item];
      payment.relations.buyer = buyer;
      payment.relations.gatewayMethod = gatewayMethod;

      this.payment = payment;
    });

    it('should return a JSON-valid object when given a payment with installments', function () {
      return expect(paymentView([this.payment])).to.eventually.be.deep.equal([paymentFinalView(null)]);
    });


    it('should return a JSON-valid object when given a payment with installments and retry', function () {
      this.payment.set('retried_with_payment_id', 12);
      return expect(paymentView([this.payment])).to.eventually.be.deep.equal([paymentFinalView('12')]);
    });

    it('should return a JSON-valid object when given a payment without installments', function () {
      this.payment.set('installments', null);
      const view = paymentFinalView(null);
      view.installments = null;

      return expect(paymentView([this.payment])).to.eventually.be.deep.equal([view]);
    });

    it('should return a JSON-valid object when given a payment without installments', function () {
      this.payment.set('retried_with_payment_id', 12);
      this.payment.set('installments', null);
      const view = paymentFinalView('12');
      view.installments = null;

      return expect(paymentView([this.payment])).to.eventually.be.deep.equal([view]);
    });
  });
});

function paymentFinalView(retriedWithPaymentId) {
  return {
    id: '10',
    gatewayReference: 'GATEWAY_REFRENCE',
    clientReference: 'CLIENT_PAYMENT_REFERENCE',
    status: 'succeed',
    type: 'creditCard',
    statusDetail: 'ok',
    createdAt: '1992-05-13T18:47:06Z',
    updatedAt: '1992-05-14T18:47:06Z',
    amountInCents: 190020,
    interestInCents: 100,
    retriedWithPaymentId: retriedWithPaymentId,
    paymentInformation: {
      firstSixDigits: '123456',
      lastFourDigits: '1234',
      processor: 'visa',
      holderDocumentNumber: '35111931',
    },
    gatewayMethod: 'GATEWAY_METHOD_TEST',
    installments: 1,
  };
}
