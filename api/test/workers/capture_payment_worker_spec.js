'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const Promise = require('bluebird');
const _ = require('lodash');
const knex = require('../../src/bookshelf').knex;
const GatewayMethod = require('../../src/models/gateway_method');
const Payment = require('../../src/models/payment');
const PaymentStatus = require('../../src/models/constants/payment_status');
const PaymentStatusDetail = require('../../src/models/constants/payment_status_detail');
const errors = require('../../src/errors');
const capturePaymentWorker = require('../../src/workers/capture_payment_worker');

describe('Workers', function () {

  describe('capturePayment', () => {
    beforeEach(() => {
      this.capturePayment = sinon.stub(Payment.prototype, 'capture', () => resolve());

      const p = knex('payments').insert({
        id: 20,
        currency: 'BRL',
        gateway_reference: 'GR_20',
        client_reference: 'CR_20',
        gateway_method_id: 1,
        status_id: PaymentStatus.pendingCapture,
        status_detail: PaymentStatusDetail.pending,
        amount: 200,
        installments: 5,
      });

      const gm = knex('gateway_methods').insert({
        id: 1,
        tenant_id: 1,
        type: 'MERCADOPAGO_CC',
        name: 'MethodA',
        enabled: true,
      });

      return Promise.all([p, gm]);
    });

    afterEach(() => {
      this.capturePayment.restore();
    });

    it('should return a rejected promise if payment not found', () => {
      return expect(capturePaymentWorker.execute(1))
        .to.be.rejectedWith(Error, 'Error fetching payment id 1');
    });

    it('should capture the payment without problems', () => {
      return expect(capturePaymentWorker.execute(20))
        .to.be.fulfilled
        .then(() => {
          return expect(this.capturePayment.callCount).to.be.equal(1);
        });
    });

    _.each([PaymentStatus.successful, PaymentStatus.pendingCapture], (status) => {
      it(`should return a fulfilled promise if the capture fails with InvalidStateChangeError when the payment is in state ${status}`, () => {
        this.capturePayment.restore();
        this.capturePayment = sinon.stub(Payment.prototype, 'capture', () => {
          return reject(new errors.InvalidStateChangeError(status, PaymentStatus.pendingCapture));
        });

        return knex('payments').where({ id: 20 }).update({ status_id: status })
          .then(() => {
            return expect(capturePaymentWorker.execute(20))
              .to.be.fulfilled
              .then(() => {
                return expect(this.capturePayment.callCount).to.be.equal(1);
              });
          });
      });
    });

    _.each([PaymentStatus.cancelled, PaymentStatus.refunded], (status) => {
      it(`should return a rejected promise if the capture fails with InvalidStateChangeError when the payment is in state ${status}`, () => {
        this.capturePayment.restore();
        this.capturePayment = sinon.stub(Payment.prototype, 'capture', () => {
          return reject(new errors.InvalidStateChangeError(status, PaymentStatus.pendingCapture));
        });

        return knex('payments').where({ id: 20 }).update({ status_id: status })
          .then(() => {
            return expect(capturePaymentWorker.execute(20))
              .to.be.rejectedWith(errors.InvalidStateChangeError);
          });
      });
    });

    it('should return a rejected promise if the capture fails with an error other than InvalidStateChangeError', () => {
      const error = new Error('An unexpected error');

      this.capturePayment.restore();
      this.capturePayment = sinon.stub(Payment.prototype, 'capture', () => {
        return reject(error);
      });

      return expect(capturePaymentWorker.execute(20)).to.be.rejectedWith(error);
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

function reject(value) {
  return new Promise(((res, rej) => {
    process.nextTick(() => {
      rej(value);
    });
  }));
}
