const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const Payment = require('../../../src/models/payment.js');
const GatewayMethod = require('../../../src/models/gateway_method.js');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const Gateway = require('../../../src/models/gateway.js');
const Promise = require('bluebird');
const errors = require('../../../src/errors');
const knex = require('../../../src/bookshelf').knex;
const PaymentStatus = require('../../../src/models/constants/payment_status');
const moment = require('moment');

const fixtures = {
  requestFromTenantMock: require('../../fixtures/paymentCreationRequest/cybersource_payment_order'),
};

describe('#Gateway Methods :: Cybersource Credit Card', () => {
  let payment;
  let cybersourceCC;
  let gateway;

  beforeEach(() => {
    cybersourceCC = new GatewayMethod();
    _.extend(cybersourceCC, require('../../../src/models/gateway_methods/cybersource_cc'));

    gateway = new Gateway();
    _.extend(gateway, require('../../../src/models/gateways/cybersource'));

    cybersourceCC.gateway = gateway;

    payment = new Payment({
      currency: 'CUR',
      amount: 34.20,
      client_reference: '0123-payment-ref',
      status_id: 'pendingAuthorize',
      type: 'creditCard',
      gateway_method_id: 1,
      tenant_id: 3,
      status_detail: PaymentStatusDetail.other,
      expiration_date: '2020-01-01T00:00:00Z',
      interest: 0.00,
      metadata: {
        captureTimestamp: '1970-01-01T00:00:00Z',
      },
    });

  });

  describe('#cancelManualRevisionPayment', () => {
    it('should call the manuallyRejectCase at gateway and return the response', () => {
      const cybersourceCCMock = sinon.stub(cybersourceCC.gateway, 'manuallyRejectCase', () => {
        return Promise.resolve();
      });

      return expect(cybersourceCC.cancelManualRevisionPayment(payment, {}))
        .to.be.fulfilled
        .then(() => {
          return expect(cybersourceCCMock.callCount).to.be.equal(1);
        });

    });

    it('should call the manuallyRejectCase at gateway and return rejected', () => {
      const cybersourceCCMock = sinon.stub(cybersourceCC.gateway, 'manuallyRejectCase', () => {
        return Promise.rejected();
      });

      return expect(cybersourceCC.cancelManualRevisionPayment(payment, {}))
        .to.be.rejected
        .then(() => {
          return expect(cybersourceCCMock.callCount).to.be.equal(1);
        });

    });
  });


  describe('#validatePayment', () => {
    it('should validate that the payment has encryption type cybersourceToken and return a resolved promise', () => {
      return expect(cybersourceCC.validatePayment(fixtures.requestFromTenantMock)).to.be.fulfilled;
    });

    it('should reject if the payment does not have cybersourceToken as encryption type', () => {
      const badMock = Object.assign({}, fixtures.requestFromTenantMock);
      badMock.encryptedCreditCards[0].encryptionType = 'NOT_A_CYBERSOURCE_TOKEN';
      return expect(cybersourceCC.validatePayment(badMock)).to.be
        .rejectedWith(errors.BadRequest, 'No credit card set in additionalInfo');
    });

    it('should reject if the payment does not have cybersourceToken as payment type', () => {
      const badMock = Object.assign({}, fixtures.requestFromTenantMock);
      badMock.type = 'NOT_A_CYBERSOURCE_TYPE';
      return expect(cybersourceCC.validatePayment(badMock)).to.be
        .rejectedWith(errors.BadRequest, 'Wrong payment type: NOT_A_CYBERSOURCE_TYPE');
    });

  });

  describe('#capturePayment', () => {
    it('should call the gateway and return the response', () => {

      const mockResponse = {
        result: {
          decision: 'ACCEPTED',
          requestID: 'CAPTURE_REQUEST_ID',
          ccCaptureReply: {
              requestDateTime: '1970-01-01T00:00:00Z',
          }
        },
      };

      const capturePayment = sinon.spy(() => {
        return Promise.resolve(mockResponse);
      });
      gateway.capturePayment = capturePayment;

      return cybersourceCC.capturePayment(payment)
        .then((res) => {
          assert.deepEqual(payment.get('metadata'), {
            captureRequestId: 'CAPTURE_REQUEST_ID',
            captureTimestamp: '1970-01-01T00:00:00Z',
          });
          assert.deepEqual(res, mockResponse);
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
          type: 'CYBERSOURCE_CC',
          name: 'MethodA',
          enabled: true,
        })
        .then(() => GatewayMethod.forge({id: 1}).fetch())
        .then((gm) => { gatewayMethod = gm });

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
          expect(config.formatter).to.equal('mercadopago'); // Dejamos formatter mercadopago para switchear rapido
          _.forEach(config.processors, (p) => {
            expect(p.installments).to.deep.equal(installments);
          });
        });
    });
  });

  describe('#cancelPayment', () => {

    let cancelledPayment;
    let refundedPayment;

    beforeEach(() => {
      cancelledPayment = payment.clone();
      refundedPayment = payment.clone();
      cancelledPayment.set('status_id', PaymentStatus.cancelled);
      refundedPayment.set('status_id', PaymentStatus.refunded);

      gateway.creditPayment = sinon.spy(() => Promise.resolve(refundedPayment));
      gateway.voidPayment = sinon.spy(() => Promise.resolve(refundedPayment));
      gateway.authorizationReversePayment = sinon.spy(() => Promise.resolve(cancelledPayment));

      moment.now = () => {
        return 0; // January 1st, 1970
      };

    });

    afterEach(() => {
      moment.now = () => {
        return +new Date(); // January 1st, 1970
      };
    });

    it('should run authorizationReversal if payment was never previously successful', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      payment.history = () => {
        return Promise.resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingAuthorize,
        ]);
      };

      return expect(cybersourceCC.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.cancelled);
          assert(gateway.authorizationReversePayment.calledOnce);
          assert(gateway.voidPayment.notCalled);
          assert(gateway.creditPayment.notCalled);
        });
    });

    it('should run voidPayment and authReversal if payment was captured in the last 24 hours', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      payment.history = () => {
        return Promise.resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.authorized,
          PaymentStatus.pendingCapture,
          PaymentStatus.successful,
        ]);
      };

      return expect(cybersourceCC.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.refunded);
          assert(gateway.authorizationReversePayment.called);
          assert(gateway.voidPayment.called);
          assert(gateway.creditPayment.notCalled);
        });
    });

    it('if payment was voided and reversal fails the cancellation should be still be fulfilled', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      payment.history = () => {
        return Promise.resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.authorized,
          PaymentStatus.pendingCapture,
          PaymentStatus.successful,
        ]);
      };

      gateway.authorizationReversePayment = sinon.spy(() => Promise.reject(new Error('Error reversing payment')));

      return expect(cybersourceCC.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.refunded);
          assert(gateway.authorizationReversePayment.called);
          assert(gateway.voidPayment.called);
          assert(gateway.creditPayment.notCalled);
        });
    });

    it('should run creditPayment if payment was captured more than 24 hours ago', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      payment.set('metadata', {
        captureTimestamp: '1960-01-01T00:00:00Z',
      });
      payment.history = () => {
        return Promise.resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.authorized,
          PaymentStatus.pendingCapture,
          PaymentStatus.successful,
        ]);
      };

      return expect(cybersourceCC.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.refunded);
          assert(gateway.authorizationReversePayment.notCalled);
          assert(gateway.voidPayment.notCalled);
          assert(gateway.creditPayment.called);
        });
    });

    it('should return a reject promise if creditPayment request failed', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      payment.set('metadata', {
        captureTimestamp: '1960-01-01T00:00:00Z',
      });
      payment.history = () => {
        return Promise.resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.authorized,
          PaymentStatus.pendingCapture,
          PaymentStatus.successful,
        ]);
      };

      gateway.creditPayment = sinon.spy(() => Promise.reject(new Error('Error crediting payment')));

      return expect(cybersourceCC.cancelPayment(payment))
        .to.be.rejectedWith('Error crediting payment')
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.pendingCancel);
          assert(gateway.authorizationReversePayment.notCalled);
          assert(gateway.voidPayment.notCalled);
          assert(gateway.creditPayment.called);
        });
    });

    it('should return a reject promise if reverseAuth request failed (if payment was never successful)', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      payment.set('metadata', {
        captureTimestamp: '1960-01-01T00:00:00Z',
      });
      payment.history = () => {
        return Promise.resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.authorized,
          PaymentStatus.pendingCapture,
        ]);
      };

      gateway.authorizationReversePayment = sinon.spy(() => Promise.reject(new Error('Error reversing payment')));

      return expect(cybersourceCC.cancelPayment(payment))
        .to.be.rejectedWith('Error reversing payment')
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.pendingCancel);
          assert(gateway.authorizationReversePayment.called);
          assert(gateway.voidPayment.notCalled);
          assert(gateway.creditPayment.notCalled);
        });
    });

    it('should return a fulfilled promise if void failed but credit returns success', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);

      payment.history = () => {
        return Promise.resolve([
          PaymentStatus.creating,
          PaymentStatus.pendingAuthorize,
          PaymentStatus.authorized,
          PaymentStatus.pendingCapture,
          PaymentStatus.successful,
        ]);
      };

      gateway.voidPayment = sinon.spy(() => Promise.reject(new Error('Error running void')));

      return expect(cybersourceCC.cancelPayment(payment))
        .to.be.fulfilled
        .then((res) => {
          assert.equal(res.get('status_id'), PaymentStatus.refunded);
          assert(gateway.authorizationReversePayment.notCalled);
          assert(gateway.voidPayment.called);
          assert(gateway.creditPayment.called);
        });
    });


  });

  describe('#voidPayment', () => {

    beforeEach(() => {
      gateway.voidPayment = sinon.spy(() => Promise.resolve(payment));
      gateway.authorizationReversePayment = sinon.spy(() => Promise.resolve(payment));
      gateway.creditPayment = sinon.spy(() => Promise.resolve(payment));
    });

    it('should call void on the gateway and leave the payment as refunded', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      return expect(cybersourceCC.voidPayment(payment))
        .to.be.fulfilled
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.refunded);
          assert(gateway.authorizationReversePayment.calledOnce);
          assert(gateway.voidPayment.calledOnce);
        });
    });

    it('should call void on the gateway and if it fails, should call credit', () => {

      gateway.voidPayment = sinon.spy(() => Promise.reject(new Error('voidError')));
      payment.set('status_id', PaymentStatus.pendingCancel);
      return expect(cybersourceCC.voidPayment(payment))
        .to.be.fulfilled
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.refunded);
          assert(gateway.creditPayment.calledOnce);
          assert(gateway.voidPayment.calledOnce);
        });
    });

    it('should call void on the gateway and if it fails, should call credit, it it fails, reject with the error', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      gateway.voidPayment = sinon.spy(() => Promise.reject(new Error('voidError')));
      gateway.creditPayment = sinon.spy(() => Promise.reject(new Error('creditError')));
      return expect(cybersourceCC.voidPayment(payment))
        .to.be.rejectedWith('creditError')
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.pendingCancel);
        });
    });

  });

  describe('#creditPayment', () => {

    beforeEach(() => {
      gateway.creditPayment = sinon.spy(() => Promise.resolve(payment));
    });

    it('should call credit on the gateway and leave the payment as refunded', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      return expect(cybersourceCC.creditPayment(payment))
        .to.be.fulfilled
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.refunded);
          assert(gateway.creditPayment.calledOnce);
        });
    });

    it('should call credit on the gateway and if it fails, reject with the error, and not modify status', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      gateway.creditPayment = sinon.spy(() => Promise.reject(new Error('creditError')));
      return expect(cybersourceCC.creditPayment(payment))
        .to.be.rejectedWith('creditError')
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.pendingCancel);
        });
    });

  });

  describe('#authorizationReversePayment', () => {

    beforeEach(() => {
      gateway.authorizationReversePayment = sinon.spy(() => Promise.resolve(payment));
    });

    it('should call auth reverse on the gateway and leave the payment as cancelled if indicated', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      return expect(cybersourceCC.authorizationReversePayment(payment, PaymentStatus.cancelled))
        .to.be.fulfilled
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.cancelled);
          assert(gateway.authorizationReversePayment.calledOnce);
        });
    });

    it('should call auth reverse on the gateway and leave the payment as refunded if indicated', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      return expect(cybersourceCC.authorizationReversePayment(payment, PaymentStatus.refunded))
        .to.be.fulfilled
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.refunded);
          assert(gateway.authorizationReversePayment.calledOnce);
        });
    });

    it('should call auth reverse on the gateway and if it fails, reject with the error', () => {

      payment.set('status_id', PaymentStatus.pendingCancel);
      gateway.authorizationReversePayment = sinon.spy(() => Promise.reject(new Error('authReverseError')));
      return expect(cybersourceCC.authorizationReversePayment(payment), PaymentStatus.refunded)
        .to.be.rejectedWith('authReverseError')
        .then(() => {
          assert.equal(payment.get('status_id'), PaymentStatus.pendingCancel);
        });
    });

  });

  describe('#chargeBackPayment', () => {
    let chargeBackPayment;

    it('should call chargeback on the gateway and if it fails should reject with the error', () => {
        gateway.chargeBackPayment = sinon.spy(() => Promise.reject(new Error('chargebackError')));

        return expect(cybersourceCC.chargeBackPayment(payment))
            .to.be.rejectedWith('chargebackError');
    });

    it('should call chargeback on the gateway and answer the same payment', () => {
        gateway.chargeBackPayment = sinon.spy(() => Promise.resolve(payment));

        return expect(cybersourceCC.chargeBackPayment(chargeBackPayment))
            .to.be.fulfilled
            .then((res) => {
                assert.deepEqual(res, chargeBackPayment);
            });
    });
  });

  describe('#postIpnProcessAction', () => {
    let chargeBackPayment;
    let queueStub;

    beforeEach(() => {
      queueStub = sinon.stub().returns(Promise.resolve());
      cybersourceCC.queue.authorizationReverseCybersource = queueStub;
    });

    it('should return a resolved promiseif resolved status is rejected and payment was already in rejected', () => {

      const ipnDataMock = { some: 'payload'};
      const resolvedStatusesMock = { status: PaymentStatus.rejected };

      return expect(cybersourceCC.postIpnProcessAction(payment, ipnDataMock, resolvedStatusesMock, PaymentStatus.rejected ))
        .to.be.fulfilled.then(() => {
          return expect(queueStub.called).to.eql(false);
        });

    });

    it('should return a resolved promise if resolved status is NOT rejected', () => {

      const ipnDataMock = { some: 'payload'};
      const resolvedStatusesMock = { status: PaymentStatus.successful };

      return expect(cybersourceCC.postIpnProcessAction(payment, ipnDataMock, resolvedStatusesMock, PaymentStatus.rejected ))
        .to.be.fulfilled.then(() => {
          return expect(queueStub.called).to.eql(false);
        });

    });

    it('should return a resolved promise if resolved status is rejected and payment was NOT already in rejected', () => {

      const ipnDataMock = { some: 'payload'};
      const resolvedStatusesMock = { status: PaymentStatus.rejected };

      return expect(cybersourceCC.postIpnProcessAction(payment, ipnDataMock, resolvedStatusesMock, PaymentStatus.pendingAuthorize ))
        .to.be.fulfilled.then(() => {
          return expect(queueStub.called).to.eql(true);
        });

    });

  });


});
