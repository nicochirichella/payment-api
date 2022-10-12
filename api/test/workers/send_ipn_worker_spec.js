'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const mockery = require('mockery');
const Promise = require('bluebird');
const _ = require('lodash');
const knex = require('../../src/bookshelf').knex;
const PaymentOrder = require('../../src/models/payment_order');
const PaymentStatus = require('../../src/models/constants/payment_status');
const sendIpnWorker = require('../../src/workers/send_ipn_worker');
const ipnService = require('../../src/services/ipn_send');

describe('Workers', function () {
  describe('sendIpn', () => {
    beforeEach(() => {
      this.ipnSendFunction = sinon.stub(ipnService, 'send', () => resolve());

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

      return Promise.all([po, pm]);
    });

    afterEach(() => {
      this.ipnSendFunction.restore();
    });

    it('should return a rejected promise if payment order not found', () => {
      return expect(sendIpnWorker.execute(1))
        .to.be.rejectedWith(Error, 'Error fetching payment order id 1');
    });

    it('should capture the payment without problems', () => {
      return expect(sendIpnWorker.execute(20))
        .to.be.fulfilled
        .then(() => {
          return expect(this.ipnSendFunction.callCount).to.be.equal(1);
        });
    });

    it('should return a rejected promise if the capture fails with an error other than InvalidStateChangeError', () => {
      const error = new Error('An unexpected error');
      this.ipnSendFunction.restore();
      this.ipnSendFunction = sinon.stub(ipnService, 'send', () => reject(error));

      return expect(sendIpnWorker.execute(20)).to.be.rejectedWith(error);
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
