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

describe('#Gateway Methods :: Adyen CC', () => {
  let payment,
    adyen,
    gateway;

  beforeEach(() => {
    adyen = new GatewayMethod();
    _.extend(adyen, require('../../../src/models/gateway_methods/adyen_cc'));

    gateway = new Gateway();
    _.extend(gateway, require('../../../src/models/gateways/adyen'));

    adyen.gateway = gateway;

    payment = new Payment({
      currency: 'CUR',
      amount: 34.20,
      client_reference: '0123-payment-ref',
      status_id: PaymentStatus.pendingAuthorize,
      gateway_method_id: 1,
      type: 'creditCard',
      tenant_id: 3,
      status_detail: PaymentStatusDetail.unknown,
    });

    payment.history = sinon.spy(() => {
      return resolve([
        PaymentStatus.pendingAuthorize,
      ]);
    });
  });

  describe('#validatePayment', () => {
    it('should reject if the payment does not correct type', () => {
      return expect(adyen.validatePayment({
        processor: 'visa',
        type: 'ticket',
        encryptedCreditCards: [{
          encryptionType: 'adyen',
          encryptedContent: 'asdasdasdasdas',
        }],
        paymentInformation: {
          processor: 'visa',

        },
      }))
        .to.be.rejectedWith(errors.BadRequest, 'Wrong payment type: ticket');
    });

    it('should validate that the payment has encryption type adyen and return a resolved promise', () => {
      return adyen.validatePayment({
        returnUrl: 'https://google.com',
        cancelCheckoutURL: 'https://hotmail.com',
        type: 'creditCard',
        encryptedCreditCards: [{
          encryptionType: 'adyen',
          encryptedContent: 'asdasdasdasdas',
        }],
        installments: 10,
      })
        .then((resp) => {
          assert.equal(resp, null);
        });
    });

    it('should reject if the the payment does not have adyen as encryption type', () => {
      return expect(adyen.validatePayment({
        returnUrl: 'https://google.com',
        cancelCheckoutURL: 'https://hotmail.com',
        type: 'creditCard',
        encryptedCreditCards: [{
          encryptionType: 'OTHER',
          encryptedContent: 'asdasdasdasdas',
        }],
        installments: 10,
      }))
        .to.be.rejectedWith(errors.BadRequest, 'No credit card set in additionalInfo');
    });

    it('should reject if the the payment has a plain credit card', () => {
      return expect(adyen.validatePayment({
        returnUrl: 'https://google.com',
        type: 'creditCard',
        cancelCheckoutURL: 'https://hotmail.com',
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
      }))
        .to.be.rejectedWith(errors.BadRequest, 'No credit card set in additionalInfo');
    });
  });

  describe('#cancelPayment', () => {
    let clock,
      now;

    beforeEach(() => {
      now = 12312312;
      clock = sinon.useFakeTimers(now);
    });

    afterEach(() => {
      clock.restore();
    });

    it('should modify the payment data and return response', () => {
      payment.set('metadata', {
        pspReference: 'originalPspReference',
        authCode: 'originalAuthCode',
        modificationPspReferences: [],
      });

      gateway.cancelPayment = function () {
        return resolve({
          pending: true,
          cancelRequestReference: 'cancelPspReference',
        });
      };

      return adyen.cancelPayment(payment)
        .then((res) => {
          assert.deepEqual(res, {
            pending: true,
            cancelRequestReference: 'cancelPspReference',
          });

          assert.deepEqual(payment.get('metadata'), {
            pspReference: 'originalPspReference',
            authCode: 'originalAuthCode',
            modificationPspReferences: [{
              pspReference: 'cancelPspReference',
              action: 'cancelOrRefund',
              date: now,
            }],
          });
        });
    });

    it('should modify the payment data', () => {
      payment.set('metadata', {
        pspReference: 'originalPspReference',
        authCode: 'originalAuthCode',
        modificationPspReferences: [],
      });

      gateway.cancelPayment = function () {
        return reject(new Error('GenericError'));
      };

      return expect(adyen.cancelPayment(payment)).to.be.rejectedWith('GenericError')
        .then(() => {
          assert.deepEqual(payment.get('metadata'), {
            pspReference: 'originalPspReference',
            authCode: 'originalAuthCode',
            modificationPspReferences: [],
          });
        });
    });
  });

  describe('#chargeBackPayment', () => {

    it('should always return an empty resolved promise', () => {
      return adyen.chargeBackPayment(payment)
        .then((res) => {
          assert.isUndefined(res);
        });
    });
  });


  describe('#capturePayment', () => {
    it('should call the gateway and return the response', () => {

      const capturePayment = sinon.spy(() => {
        return resolve('gateway response');
      });
      gateway.capturePayment = capturePayment;

      return adyen.capturePayment(payment)
        .then((res) => {
          assert.deepEqual(res, 'gateway response');
          assert(capturePayment.calledOnce);
        });

    });

  });

  describe('#getConfig', () => {
    let gatewayMethod;

    beforeEach(() => {
      const gatewayMethodPromise = knex('gateway_methods')
        .insert({
          id: 1,
          tenant_id: 1,
          type: 'ADYEN_CC',
          name: 'MethodA',
          enabled: true,
          payment_method_id: 1,
          ui_url: 'www.trocafone.com',
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

    it('should return the config for a adyen_cc', () => {
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
          expect(config.formatter).to.equal('adyen');
          const processors = _.omit(config.processors, p => p.id = 'amex');
          _.forEach(processors, (p) => {
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
