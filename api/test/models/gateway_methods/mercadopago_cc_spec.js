'use strict';

const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const Payment = require('../../../src/models/payment.js');
const GatewayMethod = require('../../../src/models/gateway_method.js');
const PaymentStatus = require('../../../src/models/constants/payment_status.js');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const Gateway = require('../../../src/models/gateway.js');
const Promise = require('bluebird');
const errors = require('../../../src/errors');
const knex = require('../../../src/bookshelf').knex;

describe('#Gateway Methods :: Mercadopago CC', () => {
  let payment,
    mercadopago,
    gateway;

  beforeEach(() => {
    mercadopago = new GatewayMethod();
    _.extend(mercadopago, require('../../../src/models/gateway_methods/mercadopago_cc'));

    gateway = new Gateway();
    _.extend(gateway, require('../../../src/models/gateways/mercadopago'));

    mercadopago.gateway = gateway;

    payment = new Payment({
      currency: 'CUR',
      amount: 34.20,
      client_reference: '0123-payment-ref',
      status_id: 'pending',
      gateway_method_id: 1,
      type: 'creditCard',
      tenant_id: 3,
      status_detail: PaymentStatusDetail.unknown,
    });

  });

  describe('#capturePayment', () => {
    let clock,
      now;

    beforeEach(() => {
      now = 12312312;
      clock = sinon.useFakeTimers(now);
    });

    afterEach(() => {
      clock.restore();
    });

    it('should call the gateway and return the response', () => {

      payment.set('metadata', {
        mercadoPagoId: 'mpid',
      });

      const capturePayment = sinon.spy(() => {
        return resolve();
      });
      gateway.capturePayment = capturePayment;

      return mercadopago.capturePayment(payment)
        .then((res) => {
          assert.deepEqual(res, undefined);
          assert(capturePayment.calledOnce);
        });

    });

  });

  describe('#validatePayment', () => {
    it('should validate that the payment has encryption type mercadopagoToken and return a resolved promise', () => {
      return mercadopago.validatePayment({
        type: 'creditCard',
        paymentInformation: {
          processor: 'visa',
        },
        encryptedCreditCards: [{
          encryptionType: 'mercadopagoToken',
          encryptedContent: 'asdasdasdasdas',
        }],
        installments: 10,
      })
        .then((resp) => {
          assert.equal(resp, null);
        });
    });

    it('should reject if the payment does not have mercadopagoToken as encryption type', () => {
      return expect(mercadopago.validatePayment({
        type: 'creditCard',
        encryptedCreditCards: [{
          encryptionType: 'OTHER',
          encryptedContent: 'asdasdasdasdas',
        }],
        installments: 10,
      }))
        .to.be.rejectedWith(errors.BadRequest, 'No credit card set in additionalInfo');
    });

    it('should reject if the payment does not correct type', () => {
      return expect(mercadopago.validatePayment({
        type: 'ticket',
        encryptedCreditCards: [{
          encryptionType: 'mercadopagoToken',
          encryptedContent: 'asdasdasdasdas',
        }],
        paymentInformation: {
          processor: 'visa',

        },
      }))
        .to.be.rejectedWith(errors.BadRequest, 'Wrong payment type: ticket');
    });

    it('should validate that the payment type does correct', () => {
      return expect(mercadopago.validatePayment({
        type: 'creditCard',
        encryptedCreditCards: [{
          encryptionType: 'mercadopagoToken',
          encryptedContent: 'asdasdasdasdas',
        }],
        paymentInformation: {
          processor: 'visa',

        },
      }))
        .to.be.successful;
    });

    it('should reject if the the payment does not receive the mercadopagoPaymentMethodId', () => {
      return expect(mercadopago.validatePayment({
        type: 'creditCard',
        encryptedCreditCards: [{
          encryptionType: 'mercadopagoToken',
          encryptedContent: 'asdasdasdasdas',
        }],
        installments: 10,
      }))
        .to.be.rejectedWith(errors.BadRequest, 'No MercadoPago payment_method_id');
    });

    it('should reject if the the payment does not receive the additionalInfo.metadata', () => {
      return expect(mercadopago.validatePayment({
        type: 'creditCard',
        encryptedCreditCards: [{
          encryptionType: 'mercadopagoToken',
          encryptedContent: 'asdasdasdasdas',
        }],
        installments: 10,
      }))
        .to.be.rejectedWith(errors.BadRequest, 'No MercadoPago payment_method_id');
    });

    it('should reject if the the payment has a plain credit card', () => {
      return expect(mercadopago.validatePayment({
        type: 'creditCard',
        additionalInfo: {
          creditCard: {
            brand: 'visa',
            installments: 10,
            number: '4111111111111111',
            expirationMonth: '12',
            expirationYear: '1990',
            holderName: 'Aasd asdasdas',
            securityCode: '023',
            documentType: 'CPF',
            documentNumber: '01249214',
          },
        },
      }))
        .to.be.rejectedWith(errors.BadRequest, 'No credit card set in additionalInfo');
    });
  });

  describe('#cancelPayment', () => {

    it('should cancel a payment that is authorized', () => {

      payment.set('metadata', {
        mercadoPagoId: 'mpid',
      });

      payment.history = function () {
        return resolve([
          PaymentStatus.pendingCancel,
          PaymentStatus.pendingCapture,
          PaymentStatus.authorized,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.creating,
        ]);
      };

      const cancelPayment = sinon.spy(() => {
        return resolve({
          status: 'cancelled',
        });
      });

      gateway.cancelPayment = cancelPayment;
      gateway.refundPayment = sinon.spy(() => reject(new Error('Should not refund the payment')));

      return mercadopago.cancelPayment(payment)
        .then((res) => {
          assert.deepEqual(res, {
            status: 'cancelled',
          });
          assert(cancelPayment.calledOnce);
        });

    });

    it('should cancel a payment that is pendingCapture', () => {

      payment.set('metadata', {
        mercadoPagoId: 'mpid',
      });

      payment.history = function () {
        return resolve([
          PaymentStatus.pendingCancel,
          PaymentStatus.pendingCapture,
          PaymentStatus.authorized,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.creating,
        ]);
      };

      const cancelPayment = sinon.spy(() => {
        return resolve({
          status: 'cancelled',
        });
      });

      gateway.cancelPayment = cancelPayment;
      gateway.refundPayment = sinon.spy(() => reject(new Error('Should not cancell refund')));

      return mercadopago.cancelPayment(payment)
        .then((res) => {
          assert.deepEqual(res, {
            status: 'cancelled',
          });
          assert(cancelPayment.calledOnce);
        });

    });


    it('should cancel a payment that is pendingAuthorize', () => {

      payment.set('metadata', {
        mercadoPagoId: 'mpid',
      });

      payment.history = function () {
        return resolve([
          PaymentStatus.pendingCancel,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.creating,
        ]);
      };

      const cancelPayment = sinon.spy(() => {
        return resolve({
          status: 'cancelled',
        });
      });

      gateway.cancelPayment = cancelPayment;
      gateway.refundPayment = sinon.spy(() => reject(new Error('Should not cancell refund')));

      return mercadopago.cancelPayment(payment)
        .then((res) => {
          assert.deepEqual(res, {
            status: 'cancelled',
          });
          assert(cancelPayment.calledOnce);
        });

    });

    it('should refund the payment if its status was successful', () => {
      payment.set('status_id', PaymentStatus.successful);
      payment.set('metadata', { mercadoPagoId: 'mpid' });

      payment.history = function () {
        return resolve([
          PaymentStatus.pendingCancel,
          PaymentStatus.inMediation,
          PaymentStatus.successful,
          PaymentStatus.pendingCapture,
          PaymentStatus.authorized,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.creating,
        ]);
      };

      const refundPayment = sinon.spy(() => resolve({ status: 'refunded' }));
      gateway.refundPayment = refundPayment;
      gateway.cancelPayment = sinon.spy(() => reject(new Error('Should not cancel the payment')));

      return mercadopago.cancelPayment(payment)
        .then((res) => {
          assert.deepEqual(res, {
            status: 'refunded',
          });
          assert(refundPayment.calledOnce);
        });
    });

    it('should refund the payment if its status was inMediation', () => {
      payment.set('status_id', PaymentStatus.inMediation);
      payment.set('metadata', { mercadoPagoId: 'mpid' });

      payment.history = function () {
        return resolve([
          PaymentStatus.pendingCancel,
          PaymentStatus.inMediation,
          PaymentStatus.successful,
          PaymentStatus.pendingCapture,
          PaymentStatus.authorized,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.creating,
        ]);
      };

      const refundPayment = sinon.spy(() => resolve({ status: 'refunded' }));
      gateway.refundPayment = refundPayment;
      gateway.cancelPayment = sinon.spy(() => reject(new Error('Should not cancel the payment')));

      return mercadopago.cancelPayment(payment)
        .then((res) => {
          assert.deepEqual(res, {
            status: 'refunded',
          });
          assert(refundPayment.calledOnce);
        });
    });
  });

  describe('#chargeBackPayment', () => {

    it('should always return an empty resolved promise', () => {
      return expect(mercadopago.chargeBackPayment(payment)).to.be.fulfilled;
    });
  });

  describe('#getConfig', () => {
    let gatewayMethod;

    beforeEach(() => {
      const gatewayMethodPromise = knex('gateway_methods')
        .insert({
          id: 1,
          tenant_id: 1,
          type: 'MERCADOPAGO_CC',
          name: 'MethodA',
          enabled: true,
        })
        .then(() => GatewayMethod.forge({ id: 1 }).fetch())
        .then(gm => gatewayMethod = gm);

      const interestRatesPromise = Promise.map([1, 2, 3], (id) => {
        return knex('interest_rates').insert({
          id,
          amount: id,
          interest: 0,
          gateway_method_id: 1,
        });
      });

      return Promise.all([gatewayMethodPromise, interestRatesPromise]);
    });

    it('should return the config for a mercadopago_cc', () => {
      const installments = [
        {
          installments: 1,
          interestPercentage: 0,
        },
        {
          installments: 2,
          interestPercentage: 0,
        },
        {
          installments: 3,
          interestPercentage: 0,
        },
      ];

      return expect(gatewayMethod.getConfig())
        .to.be.fulfilled
        .then((config) => {
          expect(config.formatter).to.equal('mercadopago');
          _.forEach(config.processors, (p) => {
            expect(p.installments).to.deep.equal(installments);
          });
        });
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

