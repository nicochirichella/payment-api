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

describe('#Gateway Methods :: Mercadopago Ticket', () => {
  let payment,
    mercadopago,
    gateway;

  beforeEach(() => {
    mercadopago = new GatewayMethod();
    _.extend(mercadopago, require('../../../src/models/gateway_methods/mercadopago_ticket'));

    gateway = new Gateway();
    _.extend(gateway, require('../../../src/models/gateways/mercadopago'));

    mercadopago.gateway = gateway;

    payment = new Payment({
      currency: 'CUR',
      amount: 34.20,
      client_reference: '0123-payment-ref',
      status_id: 'pending',
      type: 'ticket',
      gateway_method_id: 1,
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
    it('should reject if the payment does not correct type', () => {
      return mercadopago.validatePayment({
        type: 'ticket',
      })
        .then((resp) => {
          assert.equal(resp, null);
        });
    });


    it('should validate that the payment type does correct', () => {
      return expect(mercadopago.validatePayment({
        type: 'creditCard',
      })).to.be.rejectedWith(errors.BadRequest, 'Wrong payment type: creditCard');
    });
  });

  describe('#cancelPayment', () => {

    it('should cancel a payment that is pendingClientAction', () => {
      payment.set('status_id', PaymentStatus.pendingClientAction);
      payment.set('metadata', {
        mercadoPagoId: 'mpid',
      });

      payment.history = function () {
        return resolve([
          PaymentStatus.pendingClientAction,
          PaymentStatus.creating,
        ]);
      };

      gateway.cancelPayment = sinon.spy(() => resolve({
        pending: false,
        cancelRequestReference: 999,
      }));

      return expect(mercadopago.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.deepEqual(res, {
            pending: false,
            cancelRequestReference: 999,
          });
          assert(gateway.cancelPayment.calledOnce);
        });

    });

    it('should cancel a payment that is creating', () => {
      payment.set('status_id', PaymentStatus.creating);
      payment.set('metadata', {
        mercadoPagoId: 'mpid',
      });

      payment.history = function () {
        return resolve([
          PaymentStatus.creating,
        ]);
      };

      gateway.cancelPayment = sinon.spy(() => resolve({
        pending: false,
        cancelRequestReference: 999,
      }));

      return expect(mercadopago.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.deepEqual(res, {
            pending: false,
            cancelRequestReference: 999,
          });
          assert(gateway.cancelPayment.calledOnce);
        });

    });

    it('should cancel a payment that is successful', () => {
      payment.set('status_id', PaymentStatus.successful);
      payment.set('metadata', {
        mercadoPagoId: 'mpid',
      });

      payment.history = function () {
        return resolve([
          PaymentStatus.successful,
          PaymentStatus.pendingClientAction,
          PaymentStatus.creating,
        ]);
      };

      gateway.refundPayment = sinon.spy(() => resolve({
        pending: false,
        cancelRequestReference: 999,
      }));
      gateway.cancelPayment = sinon.spy(() => reject(new Error('Should not cancell refund')));

      return expect(mercadopago.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.deepEqual(res, {
            pending: false,
            cancelRequestReference: 999,
          });
          assert(gateway.refundPayment.calledOnce);
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
          type: 'MERCADOPAGO_TICKET',
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

