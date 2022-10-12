'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const PaymentOrder = require('../../src/models/index.js').PaymentOrder;
const PaymentStatus = require('../../src/models/constants/payment_status.js');
const PaymentStatusDetail = require('../../src/models/constants/payment_status_detail');
const knex = require('../../src/bookshelf').knex;
let paymentOrderExpectedResponse = require('../fixtures/views/payment_order/one_payment.json');
let paymentOrderWithRetriedPayment = require('../fixtures/views/payment_order/with_retried_payment.json');

describe('#Views', () => {

  const paymentOrderView = require('../../src/views/payment_order');
  const paymentResponseView = require('../../src/views/payment_request_response');
  const Payment = require('../../src/models/payment');
  let paymentGetter;

  before(() => {
    paymentGetter = sinon.stub(Payment.prototype, 'get', function (attr) {
      let value = this.attributes[attr];

      if (attr === 'payment_information' || attr === 'metadata') {
        value = JSON.parse(value);
      }

      return value;
    });
  });

  after(() => {
    paymentGetter.restore();
  });

  describe('Payment Order', () => {
    it('should return a JSON-valid object when given a payment order', () => {
      return expect(createPaymentOrderMock(false).then(e => paymentOrderView(e)))
        .to.eventually.be.deep.equal(paymentOrderExpectedResponse);
    });

    it('should return a JSON-valid object when given a payment order with retried payments', () => {
      return expect(createPaymentOrderMock(true).then(e => paymentOrderView(e)))
        .to.eventually.be.deep.equal(paymentOrderWithRetriedPayment);
    });
  });

  describe('Payment Response', () => {
    it('should return a JSON-valid object when given a status action', () => {
      const config = createPaymentOrderMock(false)
        .then(paymentOrder => ({
          paymentOrder,
          action: {
            type: 'status',
            data: {
              paymentOrderStatus: PaymentStatus.successful,
              reference: 'REFERENCE',
              purchaseReference: 'PURCHASE_REFERENCE',
            },
          },
        }
        ));


      return expect(config.then(response => paymentResponseView(response)))
        .to.eventually.be.deep.equal({
          paymentOrder: paymentOrderExpectedResponse,
          action: {
            type: 'status',
            data: {
              paymentOrderStatus: PaymentStatus.successful,
              reference: 'REFERENCE',
              purchaseReference: 'PURCHASE_REFERENCE',
            },
          },
        });
    });

    it('should return a JSON-valid object when given a status action and retried payments', () => {
      const config = createPaymentOrderMock(true)
        .then(paymentOrder => ({
          paymentOrder,
          action: {
            type: 'status',
            data: {
              paymentOrderStatus: PaymentStatus.successful,
              reference: 'REFERENCE',
              purchaseReference: 'PURCHASE_REFERENCE',
            },
          },
        }
        ));


      return expect(config.then(response => paymentResponseView(response)))
        .to.eventually.be.deep.equal({
          paymentOrder: paymentOrderWithRetriedPayment,
          action: {
            type: 'status',
            data: {
              paymentOrderStatus: PaymentStatus.successful,
              reference: 'REFERENCE',
              purchaseReference: 'PURCHASE_REFERENCE',
            },
          },
        });
    });

    it('should return a JSON-valid object when given a redirect action', () => {
      const config = createPaymentOrderMock(false)
        .then(paymentOrder => ({
          paymentOrder,
          action: {
            type: 'redirect',
            data: {
              redirectUrl: 'www.url.com/path',
            },
          },
        }
        ));

      return expect(config.then(response => paymentResponseView(response)))
        .to.eventually.be.deep.equal({
          paymentOrder: paymentOrderExpectedResponse,
          action: {
            type: 'redirect',
            data: {
              redirectUrl: 'www.url.com/path',
            },
          },
        });
    });

    it('should return a JSON-valid object when given a redirect action with retried payments', () => {
      const config = createPaymentOrderMock(true)
        .then(paymentOrder => ({
          paymentOrder,
          action: {
            type: 'redirect',
            data: {
              redirectUrl: 'www.url.com/path',
            },
          },
        }
        ));

      return expect(config.then(response => paymentResponseView(response)))
        .to.eventually.be.deep.equal({
          paymentOrder: paymentOrderWithRetriedPayment,
          action: {
            type: 'redirect',
            data: {
              redirectUrl: 'www.url.com/path',
            },
          },
        });
    });

    it('should throw an error when action.type is unknown', function () {
      const response = {
        payment: this.payment,
        action: {
          type: 'FAKE_ACTION',
          data: {
            extra: 'data',
          },
        },
      };

      return expect(paymentResponseView(response)).to.be.rejectedWith(Error, 'Undefined action type: FAKE_ACTION');
    });
  });
});


let createPaymentOrderMock = (withRetriedPayments) => {
  const buyerPromise = knex('buyers')
    .insert({
      id: 21,
      external_reference: '12345',
      type: 'person',
      phone: '1234567890',
      document_number: '000111222333',
      document_type: 'CPF',
      email: 'test@test.com',
      name: 'Fulanito Menganito Detal',
      created_at: '2016-01-01',
      updated_at: '2016-01-02',
      billing_city: 'City',
      billing_district: 'District',
      billing_country: 'Brazil',
      billing_complement: 'Complement',
      billing_number: '1234C',
      billing_zip_code: '23970000',
      billing_state_code: 'SC',
      billing_state: 'State',
      billing_street: 'Calle Loca',
      shipping_city: 'SCity',
      shipping_district: 'SDistrict',
      shipping_country: 'Brazil',
      shipping_complement: 'SComplement',
      shipping_number: 'S1234C',
      shipping_zip_code: 'S2397000',
      shipping_state_code: 'SSC',
      shipping_state: 'SState',
      shipping_street: 'SCalle Loca',
      gender: 'M',
      birth_date: '1980-12-10',
      ip_address: '100.200.100.200',
    });

  const itemPromise = knex('items')
    .insert({
      payment_order_id: 1,
      name: 'Samsung Galaxy Mega Duos Preto (Bom)',
      external_reference: '4499',
      discount: 10,
      total: 24.20,
      unit_cost: 34.20,
      quantity: 1,
      details: '',
    });

  const paymentPromise = knex('payments')
    .insert({
      id: 11,
      payment_order_id: 1,
      gateway_method_id: 31,
      currency: 'CUR',
      amount: 24.20,
      interest: 0.2,
      type: 'creditCard',
      client_reference: '0123-payment-ref',
      gateway_reference: 'mpMockId',
      status_id: PaymentStatus.successful,
      retried_with_payment_id: null,
      status_detail: PaymentStatusDetail.ok,
      payment_information: '{"firstSixDigits": "123456","lastFourDigits": "1234","processor": "visa"}',
      installments: 6,
      created_at: '2017-03-16T18:47:03Z',
      updated_at: '2017-03-16T18:47:03Z',
      expiration_date: '2020-01-01T00:00:00Z',
    });

  let retriedPaymentsPromise = Promise.resolve();
  if (withRetriedPayments) {
    retriedPaymentsPromise = knex('payments')
    .insert({
      id: 12,
      payment_order_id: 1,
      gateway_method_id: 32,
      currency: 'CUR',
      amount: 24.20,
      interest: 0.2,
      type: 'creditCard',
      client_reference: '0123-payment-ref_2',
      gateway_reference: 'cyberMock',
      status_id: PaymentStatus.successful,
      retried_with_payment_id: 11,
      status_detail: PaymentStatusDetail.ok,
      payment_information: '{"firstSixDigits": "123456","lastFourDigits": "1234","processor": "visa"}',
      installments: 6,
      created_at: '2017-03-16T18:47:03Z',
      updated_at: '2017-03-16T18:47:03Z',
      expiration_date: '2020-01-01T00:00:00Z',
    });
  }

  const gatewayMethodPromise = knex('gateway_methods')
    .insert([{
      id: 31,
      type: 'MERCADOPAGO_CC',
    }, {
      id: 32,
      type: 'CYBERSOURCE_CC',
    }]);

  const paymentMethodPromise = knex('payment_methods')
    .insert({
      id: 41,
      type: 'ONE_CREDIT_CARD',
    });

  return Promise.all([paymentPromise, buyerPromise, itemPromise, gatewayMethodPromise, paymentMethodPromise, retriedPaymentsPromise])
    .then(() => PaymentOrder.forge({
      id: 1,
      buyer_id: 21,
      status_id: PaymentStatus.successful,
      purchase_reference: 'PURCHASE_REFERENCE',
      reference: 'REFERENCE',
      created_at: '2017-03-16T18:47:03Z',
      updated_at: '2017-03-16T18:47:03Z',
      payment_method_id: 41,
      currency: 'BRL',
      total: 24.4,
      interest: 0.2,
      metadata: {
        successUrl: 'www.success.com',
        cancelUrl: 'www.cancel.com',
        pendingUrl: 'www.pending.com',
      },
    }));
};
