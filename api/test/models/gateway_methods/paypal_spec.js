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

describe('#Gateway Methods :: Paypal', () => {
  let payment,
    paypal,
    gateway;

  beforeEach(() => {
    paypal = new GatewayMethod();
    _.extend(paypal, require('../../../src/models/gateway_methods/paypal'));

    gateway = new Gateway();
    _.extend(gateway, require('../../../src/models/gateways/paypal'));

    paypal.gateway = gateway;

    payment = new Payment({
      currency: 'CUR',
      amount: 34.20,
      client_reference: '0123-payment-ref',
      status_id: 'pendingClientAction',
      type: 'paypal',
      gateway_method_id: 1,
      tenant_id: 3,
      status_detail: PaymentStatusDetail.other,
      expiration_date: '2020-01-01T00:00:00Z',
      interest: 0.00,
    });

  });


  describe('#validatePayment', () => {
    it('should return a resolved promise if the payment has the correct type and payment information', () => {
      return paypal.validatePayment({
        type: 'paypal',
        paymentInformation: null,
      })
        .then((resp) => {
          assert.equal(resp, null);
        });
    });

    it('should reject if the payment has something other than null on paymentInformation', () => {
      return expect(paypal.validatePayment({
        type: 'paypal',
        paymentInformation: {
          processor: 'master',
        },
      })).to.be.rejectedWith(errors.BadRequest, 'Payment information should be sent null.');
    });


    it('should reject if the payment type is something other than paypal', () => {
      return expect(paypal.validatePayment({
        type: 'creditCard',
        paymentInformation: null,
      })).to.be.rejectedWith(errors.BadRequest, 'Wrong payment type: creditCard');
    });
  });

  describe('#cancelPayment', () => {

    let cancelledPayment;

    beforeEach(() => {
      cancelledPayment = payment.clone();
      cancelledPayment.set('status_id', PaymentStatus.cancelled);

      gateway.cancelPayment = sinon.spy(() => resolve(cancelledPayment));
      gateway.refundPayment = sinon.spy(() => resolve(cancelledPayment));
    });

    it('should cancel (not refund) a payment that DOES NOT HAVE pendingExecute in its history', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      payment.history = function () {
        return resolve([
          PaymentStatus.creating,
          PaymentStatus.error,
          PaymentStatus.pendingCancel,
        ]);
      };

      return expect(paypal.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.cancelled);
          assert(gateway.cancelPayment.calledOnce);
          assert(gateway.refundPayment.notCalled);
        });
    });

    it('should cancel (not refund) a payment whose last status was pendingClientAction and status_detail OK', () => {

      payment.history = function () {
        return resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingClientAction,
          PaymentStatus.pendingExecute,
          PaymentStatus.pendingClientAction,
          PaymentStatus.pendingCancel,
        ]);
      };

      payment.set('status_detail', PaymentStatusDetail.ok);

      return expect(paypal.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.cancelled);
          assert(gateway.cancelPayment.calledOnce);
          assert(gateway.refundPayment.notCalled);
        });
    });

    it('should refund (not cancel) a payment that has been pendingExecute in the past and is not in a non refundable status', () => {

      payment.history = function () {
        return resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingClientAction,
          PaymentStatus.pendingExecute,
          PaymentStatus.successful,
          PaymentStatus.pendingCancel,
        ]);
      };

      return expect(paypal.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.cancelled);
          assert(gateway.cancelPayment.notCalled);
          assert(gateway.refundPayment.calledOnce);
        });
    });

    it('should mark as rejected (not cancel) a payment whose last status was pendingClientAction and has a non OK status_detail', () => {

      payment.history = function () {
        return resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingClientAction,
          PaymentStatus.pendingCancel,
        ]);
      };

      return expect(paypal.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.rejected);
          assert(gateway.cancelPayment.calledOnce);
          assert(gateway.refundPayment.notCalled);
        });
    });

  });

  describe('#capturePayment', () => {
    it('should call the gateway and return the response', () => {

      const capturePayment = sinon.spy(() => {
        return resolve('gateway response');
      });
      gateway.capturePayment = capturePayment;

      return paypal.capturePayment(payment)
        .then((res) => {
          assert.deepEqual(res, 'gateway response');
          assert(capturePayment.calledOnce);
        });

    });

  });

  describe('#chargeBackPayment', () => {
    it('should always return an empty resolved promise', () => {
      return expect(paypal.chargeBackPayment(payment)).to.be.fulfilled;
    });
  });


  describe('#executePayment', () => {
    it('should correctly save and return the payment returned by the gateway on successful execution (leaving existing metadata)', () => {

      payment.set('status_id', PaymentStatus.pendingClientAction);
      payment.set('metadata', { randomMetadata: 'A1230' });

      const executeData = {
        saleId: 'SALEID1',
        statusDetail: PaymentStatusDetail.by_merchant,
        status: PaymentStatus.successful,
      };
      gateway.executePayment = sinon.spy(() => resolve(executeData));

      const executeMetadata = {
        payerId: 'PAYERID1',
      };

      return paypal.executePayment(payment, executeMetadata)
        .then((payment) => {
          assert(gateway.executePayment.calledOnce);
          expect(payment.get('status_id')).to.deep.equal(PaymentStatus.successful);
          expect(payment.get('status_detail')).to.deep.equal(PaymentStatusDetail.by_merchant);
          expect(payment.get('metadata')).deep.equal({
            randomMetadata: 'A1230',
            saleId: 'SALEID1',
            payerId: 'PAYERID1',
          });
        });

    });

    it('should correctly save and return the payment returned by the gateway on successful execution (creating metadata object if null)', () => {

      payment.set('status_id', PaymentStatus.pendingClientAction);
      payment.set('metadata', null);

      const executeData = {
        saleId: 'SALEID1',
        statusDetail: PaymentStatusDetail.by_merchant,
        status: PaymentStatus.successful,
      };
      gateway.executePayment = sinon.spy(() => resolve(executeData));

      const executeMetadata = {
        payerId: 'PAYERID1',
      };

      return paypal.executePayment(payment, executeMetadata)
        .then((payment) => {
          assert(gateway.executePayment.calledOnce);
          expect(payment.get('status_id')).to.deep.equal(PaymentStatus.successful);
          expect(payment.get('status_detail')).to.deep.equal(PaymentStatusDetail.by_merchant);
          expect(payment.get('metadata')).deep.equal({
            saleId: 'SALEID1',
            payerId: 'PAYERID1',
          });
        });

    });


    it('should return rejected promise with original gateway error if gateway returns a rejected promise', () => {

      const expectedError = new Error('holis');
      gateway.executePayment = sinon.spy(() => reject(expectedError));

      expect(paypal.executePayment(payment, {})).to.be.rejected
        .then((error) => {
          expect(error).to.equal(expectedError);
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
          type: 'PAYPAL',
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

    it('should return the config for paypal installments', () => {
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
          expect(config.installments).to.deep.equal(installments);
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

