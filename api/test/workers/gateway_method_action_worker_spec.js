'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const _ = require('lodash');
const knex = require('../../src/bookshelf').knex;
const GatewayMethod = require('../../src/models/gateway_method');
const CybersourceCC = require('../../src/models/gateway_methods/cybersource_cc');
const Payment = require('../../src/models/payment');
const PaymentStatus = require('../../src/models/constants/payment_status');
const PaymentStatusDetail = require('../../src/models/constants/payment_status_detail');
const GatewayMethodActionWorker = require('../../src/workers/gateway_method_action_worker');

describe('Gateway Method Action Worker', function () {

  let paymentId = 1;

  function insertPayment() {
    return knex('payments').insert({
      id: paymentId,
      currency: 'BRL',
      gateway_reference: 'GR_20',
      client_reference: 'CR_20',
      gateway_method_id: 1,
      status_id: PaymentStatus.pendingAuthorize,
      status_detail: PaymentStatusDetail.pending,
      amount: 200,
      installments: 5,
    })
  }

  function insertGatewayMethod() {
    return knex('gateway_methods').insert({
      id: 1,
      tenant_id: 1,
      type: 'CYBERSOURCE_CC',
      name: 'MethodA',
      enabled: true,
    })
  }

  describe('#constructor', () => {

    it('should correctly set the paymentId attibute', () => {
      const gatewayMethodActionWorker = new GatewayMethodActionWorker(paymentId);
      expect(gatewayMethodActionWorker.paymentId).to.eql(paymentId);
    });

    it('should correctly set the data attribute if provided', () => {
      const data = {
        dmRequestId: '10',
      };
      const gatewayMethodActionWorker = new GatewayMethodActionWorker(paymentId, data);
      expect(gatewayMethodActionWorker.data).to.eql(data);
    });

    it('should correctly set the data attribute if not provided', () => {
      const data = {
        dmRequestId: '10',
      };
      const gatewayMethodActionWorker = new GatewayMethodActionWorker(paymentId);
      expect(gatewayMethodActionWorker.data).to.eql({});
    });

    it('should correctly set the retryOptions attribute with the correct default values', () => {

      const retryOptions = {
        retries: 3,
        factor: 2,
        minTimeout: 8000,
        maxTImeout: 30000,
      };

      const gatewayMethodActionWorker = new GatewayMethodActionWorker(paymentId);
      expect(gatewayMethodActionWorker.retryOptions).to.eql(retryOptions);
    });
  });

  describe('#getPayment', () => {

    it('should correctly retrieve the payment from the database', () => {
      const gatewayMethodActionWorker = new GatewayMethodActionWorker(paymentId);

      return Promise.all([ insertPayment(), insertGatewayMethod() ])
        .then(() => {
          return gatewayMethodActionWorker.getPayment();
        }).then((p) => {
          expect(p).to.be.an.instanceof(Payment);
          expect(p.get('id')).to.eql(paymentId);
        });
    });

    describe('#execute', () => {

      let gatewayMethodActionWorker;
      let callRetryFunctionStub;

      beforeEach(() => {
        gatewayMethodActionWorker = new GatewayMethodActionWorker(paymentId);
        callRetryFunctionStub = sinon.stub(gatewayMethodActionWorker, 'callRetryFunction').returns(Promise.resolve());
      });

      beforeEach(() => {
        return Promise.all([ insertPayment(), insertGatewayMethod() ]);
      });

      it('should execute the repeatableAction only once if it succeeds', () => {
        callRetryFunctionStub.restore();
        gatewayMethodActionWorker.retryOptions = {
          retries: 3,
          factor: 2,
          minTimeout: 100,
          maxTimeout: 300,
        };
        sinon.stub(gatewayMethodActionWorker,'repeatableAction').returns(Promise.resolve("holis"));
        return gatewayMethodActionWorker.execute().then(() => {
          return expect(gatewayMethodActionWorker.repeatableAction.callCount).to.eql(1);
        });
      });

      it('should execute the repeatableAction 4 times (1 + 3 retries) and reject the promise if it fails everytime', () => {
        callRetryFunctionStub.restore();
        gatewayMethodActionWorker.retryOptions = {
          retries: 3,
          factor: 2,
          minTimeout: 100,
          maxTimeout: 300,
        };

        sinon.stub(gatewayMethodActionWorker,'repeatableAction', () => Promise.reject(new Error("Changos!")) );

        return expect(gatewayMethodActionWorker.execute()).to.be.rejected.then(() => {
          return expect(gatewayMethodActionWorker.repeatableAction.callCount).to.eql(4);
        });
      });

      it('should call getPayment', () => {
        const c = sinon.spy(gatewayMethodActionWorker, 'getPayment');
        return gatewayMethodActionWorker.execute(() => {
          expect(gatewayMethodActionWorker).to.have.toHaveBeenCalled();
        })
      });

      it('should set payment and gateway method as attributes', () => {
        return gatewayMethodActionWorker.execute().then(() => {
          expect(gatewayMethodActionWorker.payment).to.be.an.instanceof(Payment);
          expect(gatewayMethodActionWorker.gatewayMethod).to.be.an.instanceof(GatewayMethod);
        });
      });

      it('should have called the retry function', () => {
        return gatewayMethodActionWorker.execute().then(() => {
          return expect(callRetryFunctionStub.callCount).to.eql(1);
        });
      });

      it('should return a rejected promise with the error if getPayment fails', () => {
        const err = new Error('Database problem');
        sinon.stub(gatewayMethodActionWorker, 'getPayment').returns(Promise.reject(err));
        return expect(gatewayMethodActionWorker.execute()).to.be.rejectedWith(err);
      });

      it('should return a rejected promise with the error if retryFunction fails', () => {
        const err = new Error('Error in the repeatable function');
        callRetryFunctionStub.restore();
        sinon.stub(gatewayMethodActionWorker, 'callRetryFunction', () => {
          return Promise.reject(err);
        });
        return expect(gatewayMethodActionWorker.execute()).to.be.rejectedWith(err);
      });

    });

    describe('#callRetryFunction', () => {

      let gatewayMethodActionWorker;
      let promiseRetryStub;

      beforeEach(() => {
        gatewayMethodActionWorker = new GatewayMethodActionWorker(paymentId);
        promiseRetryStub = sinon.stub(gatewayMethodActionWorker, 'promiseRetry').returns(Promise.resolve())
      });

      it('should have called the promiseRetry funtion with the correct function & options', () => {
        return gatewayMethodActionWorker.callRetryFunction().then(() => {
          expect(promiseRetryStub.callCount).to.eql(1);
          expect(promiseRetryStub.getCall(0).args[0]).to.be.a('function');
          expect(promiseRetryStub.getCall(0).args[1]).to.eql(gatewayMethodActionWorker.retryOptions);
        });
      });
    });

  })
});
