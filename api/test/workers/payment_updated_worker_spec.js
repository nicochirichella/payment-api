const expect = require('chai').expect;
const sinon = require('sinon');
const Promise = require('bluebird');
const _ = require('lodash');
const knex = require('../../src/bookshelf').knex;
const PaymentMethod = require('../../src/models/payment_method');
const PaymentOrder = require('../../src/models/payment_order');
const PaymentStatus = require('../../src/models/constants/payment_status');
const PaymentStatusDetail = require('../../src/models/constants/payment_status_detail');
const errors = require('../../src/errors');
const queueService = require('../../src/services/queue_service');
const paymentUpdatedWorker = require('../../src/workers/payment_updated_worker');

describe('Workers', () => {

  let paymentOrderUpdateStatus;
  let sendIpn;
  let shouldCapturePayments;
  let paymentOrderCapture;

  describe('paymentUpdated', () => {
    beforeEach(() => {
      paymentOrderUpdateStatus = sinon.stub(PaymentOrder.prototype, 'updateStatus', () => resolve());
      sendIpn = sinon.stub(queueService, 'sendIpn', () => resolve());
      shouldCapturePayments = sinon.stub(PaymentMethod.prototype, 'shouldCapturePayments', () => resolve(true));
      paymentOrderCapture = sinon.stub(PaymentOrder.prototype, 'capture', () => resolve());

      const p = knex('payments').insert({
        id: 10,
        currency: 'BRL',
        gateway_reference: 'GR_20',
        client_reference: 'CR_20',
        gateway_method_id: 1,
        status_id: PaymentStatus.authorized,
        status_detail: PaymentStatusDetail.pending,
        amount: 200,
        payment_order_id: 20,
        installments: 5,
      });

      const gm = knex('gateway_methods').insert({
        id: 1,
        tenant_id: 1,
        type: 'MERCADOPAGO_CC',
        name: 'MethodA',
        enabled: true,
      });

      const po = knex('payment_orders').insert({
        id: 20,
        currency: 'BRL',
        purchase_reference: 'PR_20',
        reference: 'R_20',
        payment_method_id: 1,
        buyer_id: 1,
        tenant_id: 1,
        status_id: PaymentStatus.authorized,
        total: 200,
      });

      const pm = knex('payment_methods').insert({
        id: 1,
        tenant_id: 1,
        type: 'ONE_CREDIT_CARD',
        name: 'MethodA',
        enabled: true,
      });

      return Promise.all([p, gm, po, pm]);
    });

    afterEach(() => {
      paymentOrderUpdateStatus.restore();
      sendIpn.restore();
      shouldCapturePayments.restore();
      paymentOrderCapture.restore();
    });

    it('should return a rejected promise if payment not found', () => {
      return expect(paymentUpdatedWorker.execute(1, 1))
        .to.be.rejectedWith(Error, 'Error fetching payment order id 1')
        .then(() => {
          expect(paymentOrderUpdateStatus.callCount).to.be.equal(0, '#updateStatus should NOT be called');
          expect(sendIpn.callCount).to.be.equal(0, '#sendIpn should NOT be called');
          expect(paymentOrderCapture.callCount).to.be.equal(0, 'paymentOrder#capture should NOT be called');
        });
    });

    it('should fail to update payment order status and not execute the ipn nor the authorization', () => {
      const error = new Error('Generic error');

      paymentOrderUpdateStatus.restore();
      paymentOrderUpdateStatus = sinon.stub(PaymentOrder.prototype, 'updateStatus', () => reject(error));

      return expect(paymentUpdatedWorker.execute(10, 20))
        .to.be.rejectedWith(error)
        .then(() => {
          expect(paymentOrderUpdateStatus.callCount).to.be.equal(1, '#updateStatus should be called');
          expect(sendIpn.callCount).to.be.equal(0, '#sendIpn should NOT be called');
          expect(paymentOrderCapture.callCount).to.be.equal(0, 'paymentOrder#capture should NOT be called');
        });
    });

    it('should fail to send ipn and not execute the authorization', () => {
      const error = new Error('Generic error');

      sendIpn.restore();
      sendIpn = sinon.stub(queueService, 'sendIpn', () => {
        return reject(error);
      });
      return expect(paymentUpdatedWorker.execute(10, 20))
        .to.be.rejectedWith(error)
        .then(() => {
          expect(paymentOrderUpdateStatus.callCount).to.be.equal(1, '#updateStatus should be called');
          expect(sendIpn.callCount).to.be.equal(1, '#sendIpn should be called');
          expect(paymentOrderCapture.callCount).to.be.equal(0, 'paymentOrder#capture should NOT be called');

          expect(sendIpn.firstCall.args[0].get('id')).to.be.equal(20);
        });
    });

    it('should fail to authorize a payment', () => {
      const error = new Error('Generic error');

      paymentOrderCapture.restore();
      paymentOrderCapture = sinon.stub(PaymentOrder.prototype, 'capture', () => {
        return reject(error);
      });
      return expect(paymentUpdatedWorker.execute(10, 20))
        .to.be.rejectedWith(error)
        .then(() => {
          expect(paymentOrderUpdateStatus.callCount).to.be.equal(1, '#updateStatus should be called');
          expect(sendIpn.callCount).to.be.equal(1, '#sendIpn should be called');
          expect(paymentOrderCapture.callCount).to.be.equal(1, 'paymentOrder#capture should be called');
          expect(sendIpn.firstCall.args[0].get('id')).to.be.equal(20);
        });
    });

    it('should send the ipn and authorize', () => {
      return expect(paymentUpdatedWorker.execute(10, 20))
        .to.be.fulfilled
        .then(() => {
          expect(paymentOrderUpdateStatus.callCount).to.be.equal(1, '#updateStatus should be called');
          expect(sendIpn.callCount).to.be.equal(1, '#sendIpn should be called');
          expect(paymentOrderCapture.callCount).to.be.equal(1, 'paymentOrder#capture should be called');

          expect(sendIpn.firstCall.args[0].get('id')).to.be.equal(20);
        });
    });

    it('should go on if the capture fails due to InvalidStatusTransition from pendingCapture state', () => {
      paymentOrderCapture.restore();
      paymentOrderCapture = sinon.stub(PaymentOrder.prototype, 'capture', () => {
        return reject(new errors.InvalidStateChangeError(PaymentStatus.pendingCapture, PaymentStatus.pendingCapture));
      });

      return expect(paymentUpdatedWorker.execute(10, 20))
        .to.be.fulfilled
        .then(() => {
          expect(paymentOrderUpdateStatus.callCount).to.be.equal(1, '#updateStatus should be called');
          expect(sendIpn.callCount).to.be.equal(1, '#sendIpn should be called');
          expect(paymentOrderCapture.callCount).to.be.equal(1, 'paymentOrder#capture should be called');

          expect(sendIpn.firstCall.args[0].get('id')).to.be.equal(20);
        });
    });

    it('should send the ipn but not authorize', () => {
      shouldCapturePayments.restore();
      shouldCapturePayments = sinon.stub(PaymentMethod.prototype, 'shouldCapturePayments', () => resolve(false));

      return expect(paymentUpdatedWorker.execute(10, 20))
        .to.be.fulfilled
        .then(() => {
          expect(paymentOrderUpdateStatus.callCount).to.be.equal(1, '#updateStatus should be called');
          expect(sendIpn.callCount).to.be.equal(1, '#sendIpn should be called');
          expect(paymentOrderCapture.callCount).to.be.equal(0, 'paymentOrder#capture should NOT be called');

          expect(sendIpn.firstCall.args[0].get('id')).to.be.equal(20);
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

function reject(value) {
  return new Promise(((res, rej) => {
    process.nextTick(() => {
      rej(value);
    });
  }));
}
