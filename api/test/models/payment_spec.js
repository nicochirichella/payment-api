'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;
const mockery = require('mockery');
const sinon = require('sinon');
const _ = require('lodash');
const errors = require('../../src/errors');
const moment = require('moment-business-time');


describe('Payment Model', () => {

  before(function () {
    mockery.enable({
      warnOnUnregistered: false,
      useCleanCache: true,
    });

    const stubs = require('../stubs');
    mockery.registerMock('./gateway_methods/index', stubs.gatewayMethods);


    require('../../src/validations');

    this.knex = require('../../src/bookshelf').knex;
    this.PaymentStatus = require('../../src/models/constants/payment_status');
    this.GatewayMethod = require('../../src/models/gateway_method');
    this.Payment = require('../../src/models/payment');
    this.PaymentStatusDetail = require('../../src/models/constants/payment_status_detail');
  });

  beforeEach(function () {
    return this.knex('gateway_methods').insert({
      id: 1,
      tenant_id: 1,
      type: 'TYPEA',
      name: 'MethodA',
      enabled: true,
      post_execute_ttl: 60,
      pre_execute_ttl: 10000,
      payment_ttl_include_weekends: true,
      syncronic_capture: false,
      payment_method_id: 1,
    }).then(() => {
      return this.GatewayMethod.forge({ id: 1 }).fetch();
    }).then((gm) => {
      this.gatewayMethod = gm;
    });
  });

  beforeEach(function () {
    return this.knex('payments').insert({
      id: 10,
      currency: 'CUR',
      amount: 34.20,
      interest: 3.42,
      type: 'creditCard',
      status_id: 'authorized',
      gateway_method_id: 1,
      tenant_id: 1,
      client_reference: 'CLIENT_REFERENCE_1',
      status_detail: this.PaymentStatusDetail.unknown,
      expiration_date: new Date(),
    })
      .then(() => {
        return this.Payment.forge({ id: 10 }).fetch();
      })
      .then((p) => {
        this.payment = p;
      });
  });

  after(() => {
    mockery.deregisterMock('./gateway_methods/index');
    mockery.disable();
  });

  describe('#create', () => {

    beforeEach(function () {
      this.request = _.clone(require('../fixtures/paymentCreationRequest/payment_order_three_payments.json'), true);
    });

    it('should create a Payment', function () {
      const payment = this.request.paymentOrder.payments[0];
      payment.currency = 'BRL';
      payment.clientReference = 'CLIENT_REFERENCE_1';
      payment.expiration_date = new Date('2019-01-21T15:13:14.774000Z');

      return expect(this.Payment.create(this.gatewayMethod, payment))
        .to.be.fulfilled
        .then((payment) => {
          const gatewayMethod = payment.related('gatewayMethod');
          // Payment check
          assert.equal(payment.get('installments'), 6);
          assert.equal(payment.get('status_id'), this.PaymentStatus.creating);
          assert.equal(payment.get('amount'), 300);
          assert.equal(payment.get('currency'), 'BRL');
          assert.equal(payment.get('client_reference'), 'CLIENT_REFERENCE_1');

          // Payment Method check
          assert.equal(gatewayMethod.get('id'), 1);
          assert.equal(gatewayMethod.get('type'), 'TYPEA');
        });
    });

    it('should fail the creation if the payment has corrupted data', function () {
      const payment = this.request.paymentOrder.payments[1];
      payment.currency = '124124';

      const promise = this.Payment.create(this.gatewayMethod, payment);

      return expect(promise).to.be.rejected
        .then((err) => {
          assert.equal(err.code, 'validation_error');
          assert.equal(_.get(err, 'context.errors.currency.message'), 'The currency must be exactly 3 characters long');
        });
    });
  });

  describe('#capture', () => {
    let queueService;
    let queueStub;

    beforeEach(function () {
      this.gatewayMethodCapturePayment = sinon.stub(this.GatewayMethod.prototype, 'capturePayment', () => resolve());
      queueService = require('../../src/services/queue_service');
      queueStub = sinon.stub(queueService, 'sendIpn').returns(Promise.resolve());
    });

    afterEach(function () {
      this.gatewayMethodCapturePayment.restore();
      queueStub.restore();
    });

    it('should set the payment to pendingCapture if pm returns a resolved promise with a non sync capture', function () {
      return this.payment.capture()
        .then(() => {
          assert.equal(this.payment.get('status_id'), this.PaymentStatus.pendingCapture);
        });
    });

    it('should set the payment to success if pm returns a resolved promise with a sync capture', function () {
      this.gatewayMethod.set('syncronic_capture', true);
      this.gatewayMethod.set('enabled', true);

      const updateStatusStub = sinon.stub().returns(Promise.resolve());
      const poStub = {
        updateStatus: updateStatusStub,
      };

      const originalGetRelation = this.payment.getRelation;
      this.payment.getRelation = (relationName) => {
        if (relationName === 'paymentOrder') {
          return Promise.resolve(poStub)
        }
        return originalGetRelation.apply(this.payment, [relationName]);
      };

      return this.gatewayMethod.save()
        .then(() => {
          return this.payment.capture()
            .then(() => {
              assert.equal(this.payment.get('status_id'), this.PaymentStatus.successful);
              assert.equal(updateStatusStub.calledOnce, true);
            });
        });
    });

    it('should return an InvalidStateChangeError if the payment is not in a status available to capture', function () {
      return this.payment.set('status_id', this.PaymentStatus.chargedBack)
        .save()
        .then(() => {
          return expect(this.payment.capture())
            .to.be.rejected
            .then((err) => {
              assert.equal(err.name, 'InvalidStateChangeError');
              assert.equal(this.payment.get('status_id'), this.PaymentStatus.chargedBack);
            });
        });
    });

    it('should not change the payment status if pm returns a rejected promise', function () {
      const err = new Error('some exception');
      this.gatewayMethodCapturePayment.restore();
      this.gatewayMethodCapturePayment = sinon.stub(this.GatewayMethod.prototype, 'capturePayment', () => reject(err));

      return expect(this.payment.capture())
        .to.be.rejectedWith(err)
        .then(() => {
          assert.equal(this.payment.get('status_id'), this.PaymentStatus.authorized);
        });
    });

  });

  describe('#cancel', () => {
    beforeEach(function () {
      this.gatewayMethodCancelPayment = sinon.stub(this.GatewayMethod.prototype, 'cancelPayment', () => resolve());
    });

    afterEach(function () {
      this.gatewayMethodCancelPayment.restore();
    });

    it('should cancel the payment and set the status to pending cancel if the gm resolves the promise', function () {
      return this.payment.cancel()
        .then(() => {
          assert.equal(this.payment.get('status_id'), this.PaymentStatus.pendingCancel);
        });
    });

    it('should return an InvalidStateChangeError if the payment is not in a status available to cancel', function () {
      return this.payment.set('status_id', this.PaymentStatus.chargedBack)
        .save()
        .then(() => {
          return expect(this.payment.cancel())
            .to.be.rejected
            .then((err) => {
              assert.equal(err.name, 'InvalidStateChangeError');
              assert.equal(this.payment.get('status_id'), this.PaymentStatus.chargedBack);
            });
        });
    });

    it('should not change the payment status if gm returns a rejected promise', function () {
      const err = new Error('some error');
      this.gatewayMethodCancelPayment.restore();
      this.gatewayMethodCancelPayment = sinon.stub(this.GatewayMethod.prototype, 'cancelPayment', () => reject(err));

      return expect(this.payment.cancel())
        .to.be.rejectedWith(err)
        .then(() => {
          assert.equal(this.payment.get('status_id'), this.PaymentStatus.authorized);
        });
    });
  });

  describe('#execute', () => {
    beforeEach(function () {
      this.gatewayMethodExecutePayment = sinon.stub(this.GatewayMethod.prototype, 'executePayment', () => resolve());
    });

    afterEach(function () {
      this.gatewayMethodExecutePayment.restore();
    });

    beforeEach(function () {
      return this.payment.set('status_id', 'pendingClientAction').save();
    });

    it('should execute the payment and set the status to pendingExecute if the gm resolves the promise', function () {
      return this.payment.execute()
        .then(() => {
          assert.equal(this.payment.get('status_id'), this.PaymentStatus.pendingExecute);
        });
    });

    let clock;

    it('should save the payment with the expiration date calculated by the getExpirationDateAfterExecute', function () {

      this.getExpirationDateAfterExecuteMock = sinon.stub(this.GatewayMethod.prototype, 'getExpirationDateAfterExecute', () =>
        resolve(new Date('2050-01-01T00:00:00.000000Z')));

      const oldExpirationDate = this.payment.get('expiration_date');
      return this.payment.execute()
        .then(() => {
          assert.equal(moment(new Date('2050-01-01T00:00:00.000000Z')).utc().format(), moment(this.payment.get('expiration_date')).utc().format());
        });
    });

    it('should return an InvalidStateChangeError if the payment is not in a status available to execute', function () {
      return this.payment.set('status_id', this.PaymentStatus.successful)
        .save()
        .then(() => {
          return expect(this.payment.execute())
            .to.be.rejected
            .then((err) => {
              assert.equal(err.name, 'InvalidStateChangeError');
              assert.equal(this.payment.get('status_id'), this.PaymentStatus.successful);
            });
        });
    });

    it('should not change the payment status if gm returns a rejected promise', function () {

      const err = new Error('some error');
      this.gatewayMethodExecutePayment.restore();
      this.gatewayMethodExecutePayment = sinon.stub(this.GatewayMethod.prototype, 'executePayment', () => reject(err));

      return expect(this.payment.execute())
        .to.be.rejectedWith(err)
        .then(() => {
          assert.equal(this.payment.get('status_id'), this.PaymentStatus.pendingClientAction);
        });
    });
  });

  describe('#hasRejections', () => {

    it('should return false if there is no metadata', function () {
      this.payment.set('metadata', null);
      expect(this.payment.hasRejections()).to.be.false;
    });
    it('should return false if rejections is an empty array ', function () {
      this.payment.set('metadata', {
        rejections: [],
      });
      expect(this.payment.hasRejections()).to.be.false;
    });
    it('should return false if rejections is null ', function () {
      this.payment.set('metadata', {
        rejections: null,
      });
      expect(this.payment.hasRejections()).to.be.false;
    });
    it('should return true if rejections has at least a rejection ', function () {
      this.payment.set('metadata', {
        rejections: [{
          created_at: '2018-01-04T18:23:27.303Z',
          reason: 'INVALID_OR_EXPIRED_TOKEN',
          status_detail: 'expired',
        }],
      });
      expect(this.payment.hasRejections()).is.true;
    });

  });

  describe('#chargedBack', () => {
    beforeEach(function () {
      this.gatewayMethodChargeBackPayment = sinon.stub(this.GatewayMethod.prototype, 'chargeBackPayment', () => resolve());
    });

    afterEach(function () {
      this.gatewayMethodChargeBackPayment.restore();
    });

    beforeEach(function () {
      return this.payment.set('status_id', 'pendingCapture').save();
    });

    it('should charged-back the payment and set the status to chargedBack if the gm resolves the promise', function () {
      return this.payment.chargeBack()
        .then(() => {
          assert.equal(this.payment.get('status_id'), this.PaymentStatus.chargedBack);
        });

    });

    it('should return an InvalidStateChangeError if the payment is not in a status available to chargeBack', function () {
      return this.payment.set('status_id', 'authorized').save()
        .then(() => {
          return expect(this.payment.chargeBack())
            .to.be.rejected
            .then((err) => {
              assert.equal(err.name, 'InvalidStateChangeError');
              assert.equal(this.payment.get('status_id'), this.PaymentStatus.authorized);
            });
        });
    });

    it('should not change the payment status if gm returns a rejected promise', function () {
      const err = new Error('some exception');
      this.gatewayMethodChargeBackPayment.restore();
      this.gatewayMethodChargeBackPayment = sinon.stub(this.GatewayMethod.prototype, 'chargeBackPayment', () => reject(err));

      return expect(this.payment.chargeBack())
        .to.be.rejectedWith(err)
        .then(() => {
          assert(this.gatewayMethod.chargeBackPayment.calledOnce);
          assert.equal(this.payment.get('status_id'), this.PaymentStatus.pendingCapture);
        });
    });
  });

  describe('Virtual Properties', () => {
    describe('#total', () => {
      it('should add no interest if interest = 0', function () {
        this.payment.set('amount', 100.12);
        this.payment.set('interest', 0);
        expect(this.payment.get('total')).is.equal(100.12);
      });

      it('should add interest if interest > 0', function () {
        this.payment.set('amount', 100.12);
        this.payment.set('interest', 10.42);
        expect(this.payment.get('total')).is.equal(110.54);
      });

      it('should add interest if interest < 0', function () {
        this.payment.set('amount', 100.12);
        this.payment.set('interest', -90.09);
        expect(this.payment.get('total')).is.equal(10.03);
      });

      it('should always return 2 decimals', function () {
        this.payment.set('amount', 0.2);
        this.payment.set('interest', 0.1);
        expect(this.payment.get('total')).is.equal(0.3);
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
