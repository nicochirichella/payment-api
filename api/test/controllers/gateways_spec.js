'use strict';

const _ = require('lodash');
const assert = require('chai').assert;
const sinon = require('sinon');
const Promise = require('bluebird');
const mockery = require('mockery');
const stubs = require('../stubs');
const errors = require('../../src/errors.js');

describe('#Gateways controller', () => {
  let Payment,
    PaymentFetch;
  before(function () {
    mockery.enable({
      warnOnUnregistered: false,
      useCleanCache: true,
    });

    this.queueService = {};
    mockery.registerMock('../services/queue_service', this.queueService);

    this.gatewayController = require('../../src/controllers/gateways');
    Payment = require('../../src/models/payment');
  });

  after(() => {
    mockery.deregisterMock('../services/queue_service');
    mockery.disable();
  });

  beforeEach(function () {
    const self = this;

    this.setPaymentUpdated = function (fn) {
      this.queueService.paymentUpdated = fn;
    };

    this.queueService.paymentUpdated = sinon.spy(() => {
      return resolve();
    });

    PaymentFetch = sinon.stub(Payment.prototype, 'fetch');
    PaymentFetch.returns(resolve({ id: 1 }));
  });

  afterEach(() => {
    PaymentFetch.restore();
  });

  beforeEach(function () {
    const self = this;
    this.setSuccessCallback = function (fn) {
      self.successCallback = fn;
    };

    this.setFailCallback = function (fn) {
      self.failCallback = fn;
    };

    this.setProcessIpn = function (fn) {
      self.processIpn = fn;
    };

    this.setSaveIncomingIpn = function (fn) {
      self.saveIncomingIpn = fn;
    };

    this.setSaveFailedIpn = function (fn) {
      self.saveFailedIpn = fn;
    };

    this.setParseIpnPayload = function (fn) {
      self.parseIpnPayload = fn;
    };

    this.setIpnFailResponse = function (fn) {
      self.ipnFailResponse = fn;
    };

    this.setPaymentGetProperty = function (fn) {
      self.paymentGetProperty = fn;
    };

    this.successCallback = function () {
    };

    this.failCallback = function () {
    };

    this.processIpn = sinon.spy(() => {
      return resolve({
        propagate: true,
        payment: self.createMockPayment(),
      });
    });

    this.createMockPayment = () => ({
      get: self.paymentGetProperty,
    });

    this.saveIncomingIpn = sinon.spy(() => {
      return resolve();
    });

    this.saveFailedIpn = sinon.spy(() => {
      return resolve();
    });

    this.parseIpnPayload = sinon.spy(() => {
      return resolve();
    });

    this.ipnFailResponse = sinon.spy((res, err) => {
      throw err;
    });

    this.paymentGetProperty = sinon.spy((prop) => {
      if (prop === 'status_id') {
        return 'pendingAuthorize';
      }

      return null;
    });


    this.gateway = {
      ipnFailResponse: (res, err) => self.ipnFailResponse(res, err),
      ipnSuccessResponse: res => self.successCallback(res),
      processIpn: (tenant, ipnData) => self.processIpn(tenant, ipnData),
      saveIncomingIpn: (ipn, payment) => self.saveIncomingIpn(ipn, payment),
      saveFailedIpn: (ipn, reference, error) => self.saveFailedIpn(ipn, reference, error),
      parseIpnPayload: body => self.parseIpnPayload(body),
      get: sinon.stub(),
    };

    this.tenant = {
      get: sinon.stub(),
    };

    this.request = {
      context: {
        gateway: this.gateway,
        tenant: this.tenant,
      },
      log: stubs.logger,
    };

    this.response = {};

    this.next = err => self.failCallback(err);
  });

  describe('#processIpn', () => {
    beforeEach(function () {
      this.request.context.ipnData = [];
    });

    describe('zero notifications', () => {
      it('should send a response', function (done) {
        const self = this;

        this.setSuccessCallback((res) => {
          assert.equal(res, self.response);
          assert.equal(self.queueService.paymentUpdated.callCount, 0);
          assert.equal(self.processIpn.callCount, 0);
          assert.equal(self.saveIncomingIpn.callCount, 0);
          assert.equal(self.saveFailedIpn.callCount, 0);
          done();
        });

        this.setFailCallback(done);

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });
    });

    describe('single notification', () => {
      beforeEach(function () {
        this.request.context.ipnData = [
          {
            payloadJson: { payload: 'en json' },
            client_reference: 'PAYMENT_REFERENCE',
          },
        ];
      });

      it('should send a response if the notification is successfully parsed and propagated', function (done) {
        const self = this;

        this.setSuccessCallback((res) => {
          assert.equal(res, self.response);
          assert.equal(self.queueService.paymentUpdated.callCount, 1, '#queueService.paymentUpdated should called once');
          assert.equal(self.processIpn.callCount, 1, '#processIpn should called once');
          assert.equal(self.saveIncomingIpn.callCount, 1, '#saveIncomingIpn should called once');
          assert.equal(self.saveFailedIpn.callCount, 0, '#saveFailedIpn should not have been called');
          done();
        });

        this.setFailCallback(done);

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should send a response if the notification is successfully parsed and event "paymentUpdated" is send, but the ipn was not saved correctly', function (done) {
        const self = this;

        const saveIncomingIpn = sinon.spy(() => {
          return reject(new Error('Problem with save'));
        });

        this.setSaveIncomingIpn(saveIncomingIpn);

        this.setSuccessCallback((res) => {
          assert.equal(self.queueService.paymentUpdated.callCount, 1, '#queueService.paymentUpdated should called one');
          assert.equal(self.processIpn.callCount, 1, '#processIpn should called one');
          assert.equal(saveIncomingIpn.callCount, 1, '#saveIncomingIpn should called one');
          assert.equal(self.saveFailedIpn.callCount, 0, '#saveFailedIpn should not have been called');
          done();
        });

        this.setFailCallback(done);

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should call middleware\'s next and not try to propagate if the notification had problems while parsing ', function (done) {
        const self = this;
        const error = new Error('Problem with ipn');
        const problemWithProcessIpn = sinon.spy(() => {
          return reject(error);
        });

        this.setProcessIpn(problemWithProcessIpn);
        this.setFailCallback((err) => {
          assert.equal(err.message, 'One or more ipns failed');
          assert.equal(err.code, 'bad_request');
          assert.equal(_.size(err.context.errors), 1, 'Error should only have 1 error');
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE'), error.message);

          assert.equal(problemWithProcessIpn.callCount, 1, 'Problem to process ipn');
          assert.equal(self.saveIncomingIpn.callCount, 0, 'should not call #saveIncomingIpn');
          assert.equal(self.queueService.paymentUpdated.callCount, 0, 'should not call #queueService.paymentUpdated');
          assert.equal(self.saveFailedIpn.callCount, 1, '#saveFailedIpn should called one');
          done();
        });

        this.setSuccessCallback(() => {
          done(new Error('should not try to send a response'));
        });

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should call middleware\'s next if the notification had problems sending event "paymentUpdated"', function (done) {
        const self = this;
        const error = new Error('problems propagating the ipn');

        this.setFailCallback((err) => {
          assert.equal(err.message, 'One or more ipns failed');
          assert.equal(_.size(err.context.errors), 1);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE'), error.message);

          assert.equal(self.queueService.paymentUpdated.callCount, 1, '#queueService.paymentUpdated should called once');
          assert.equal(self.processIpn.callCount, 1, '#processIpn should called once');
          assert.equal(self.saveIncomingIpn.callCount, 1, '#saveIncomingIpn should called once');
          assert.equal(self.saveFailedIpn.callCount, 1, '#saveFailedIpn have been called once');
          done();
        });

        this.setSuccessCallback(() => done(new Error('should not call try to send a response!')));

        this.setPaymentUpdated(sinon.spy(() => reject(error)));

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should call middleware\'s next if did not found the payment', function (done) {
        const self = this;

        PaymentFetch.restore();

        this.setFailCallback((err) => {
          assert.equal(err.message, 'One or more ipns failed');
          assert.equal(_.size(err.context.errors), 1);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE'), 'Payment reference not found');

          assert.equal(self.queueService.paymentUpdated.callCount, 0, '#queueService.paymentUpdated should called once');
          assert.equal(self.processIpn.callCount, 0, '#processIpn should called once');
          assert.equal(self.saveIncomingIpn.callCount, 0, '#saveIncomingIpn should called once');
          assert.equal(self.saveFailedIpn.callCount, 1, '#saveFailedIpn have been called once');
          done();
        });

        this.setSuccessCallback(() => done(new Error('should not call try to send a response!')));

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });
    });

    describe('multiple notifications', () => {
      beforeEach(function () {
        this.ipnData1 = {
          payloadJson: { payload: 'en json 1' },
          client_reference: 'PAYMENT_REFERENCE_1',
        };
        this.ipnData2 = {
          payloadJson: { payload: 'en json 2' },
          client_reference: 'PAYMENT_REFERENCE_2',
        };
        this.ipnData3 = {
          payloadJson: { payload: 'en json 3' },
          client_reference: 'PAYMENT_REFERENCE_3',
        };
        this.ipnData4 = {
          payloadJson: { payload: 'en json 4' },
          client_reference: 'PAYMENT_REFERENCE_4',
        };

        this.ipnData5 = {
          payloadJson: { payload: 'en json 5' },
          client_reference: 'PAYMENT_REFERENCE_5',
        };
        this.request.context.ipnData = [this.ipnData1, this.ipnData2, this.ipnData3, this.ipnData4, this.ipnData5];
      });

      it('should call response the request if the notifications are successfully parsed and event "paymentUpdated" is send', function (done) {
        const self = this;

        this.setSuccessCallback((res) => {
          assert.equal(res, self.response);
          assert.equal(self.queueService.paymentUpdated.callCount, 5, '#queueService.paymentUpdated should called five times');
          assert.equal(self.processIpn.callCount, 5, '#processIpn should called five times');
          assert.equal(self.saveIncomingIpn.callCount, 5, '#saveIncomingIpn should called five times');
          assert.equal(self.saveFailedIpn.callCount, 0, '#saveFailedIpn should not have been called');
          done();
        });

        this.setFailCallback(done);

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should call response the request if the notifications are successfully parsed and event "paymentUpdated" is send, but some of the ipns were not saved correctly', function (done) {
        const self = this;

        this.setSuccessCallback((res) => {
          assert.equal(res, self.response);
          assert.equal(self.queueService.paymentUpdated.callCount, 5, '#queueService.paymentUpdated should called five times');
          assert.equal(self.processIpn.callCount, 5, '#processIpn should called five times');
          assert.equal(self.saveIncomingIpn.callCount, 5, '#saveIncomingIpn should called five times');
          assert.equal(self.saveFailedIpn.callCount, 0, '#saveFailedIpn should not have been called');
          done();
        });

        this.setFailCallback(done);

        this.setSaveIncomingIpn(sinon.spy(() =>
          reject(new Error('IPN couldn\'t be saved'))));

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should call middleware\'s next and not try to propagate if it could not found any payments', function (done) {
        const self = this;

        PaymentFetch.restore();

        this.setSuccessCallback(() => done(new Error('should not call try to send a response!')));

        this.setFailCallback((err) => {
          assert.equal(err.message, 'One or more ipns failed');
          assert.equal(_.size(err.context.errors), 5);
          assert.deepEqual(_.get(err, 'context.errors'), {
            PAYMENT_REFERENCE_1: 'Payment reference not found',
            PAYMENT_REFERENCE_2: 'Payment reference not found',
            PAYMENT_REFERENCE_3: 'Payment reference not found',
            PAYMENT_REFERENCE_4: 'Payment reference not found',
            PAYMENT_REFERENCE_5: 'Payment reference not found',
          });

          assert.equal(self.queueService.paymentUpdated.callCount, 0, '#queueService.paymentUpdated should called zero times');
          assert.equal(self.processIpn.callCount, 0, '#processIpn should called five times');
          assert.equal(self.saveIncomingIpn.callCount, 0, '#saveIncomingIpn should called zero times');
          assert.equal(self.saveFailedIpn.callCount, 5, '#saveFailedIpn should have been called 5 times');
          done();
        });

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should call middleware\'s next and not try to propagate if some notifications had problems while parsing ', function (done) {
        const self = this;
        const errors = [];
        for (let i = 0; i < 5; i++) {
          errors.push(new Error(`problems processing the ipn ${i}`));
        }

        this.setSuccessCallback(() => done(new Error('should not call try to send a response!')));

        this.setFailCallback((err) => {
          assert.equal(err.message, 'One or more ipns failed');
          assert.equal(_.size(err.context.errors), 5);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_1'), errors[0].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_2'), errors[1].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_3'), errors[2].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_4'), errors[3].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_5'), errors[4].message);

          assert.equal(self.queueService.paymentUpdated.callCount, 0, '#queueService.paymentUpdated should called zero times');
          assert.equal(self.processIpn.callCount, 5, '#processIpn should called five times');
          assert.equal(self.saveIncomingIpn.callCount, 0, '#saveIncomingIpn should called zero times');
          assert.equal(self.saveFailedIpn.callCount, 5, '#saveFailedIpn should have been called 5 times');
          done();
        });

        const stub = sinon.stub();
        stub.withArgs(this.ipnData1.payloadJson).returns(reject(errors[0]));
        stub.withArgs(this.ipnData2.payloadJson).returns(reject(errors[1]));
        stub.withArgs(this.ipnData3.payloadJson).returns(reject(errors[2]));
        stub.withArgs(this.ipnData4.payloadJson).returns(reject(errors[3]));
        stub.withArgs(this.ipnData5.payloadJson).returns(reject(errors[4]));

        this.setProcessIpn(sinon.spy((payment, ipnData) => stub(ipnData)));

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should call middleware\'s next with the original error if it has problems saving the failed ipn', function (done) {
        const self = this;
        const errors = [];
        for (let i = 0; i < 5; i++) {
          errors.push(new Error(`problems processing the ipn ${i}`));
        }

        this.setSaveFailedIpn(sinon.spy(() =>
          reject(new Error('FailedIpn couldn\'t be saved'))));

        this.setSuccessCallback(() => done(new Error('should not call try to send a response!')));

        this.setFailCallback((err) => {
          assert.equal(err.message, 'One or more ipns failed');
          assert.equal(_.size(err.context.errors), 5);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_1'), errors[0].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_2'), errors[1].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_3'), errors[2].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_4'), errors[3].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_5'), errors[4].message);

          assert.equal(self.queueService.paymentUpdated.callCount, 0, '#queueService.paymentUpdated should called zero times');
          assert.equal(self.processIpn.callCount, 5, '#processIpn should called five times');
          assert.equal(self.saveIncomingIpn.callCount, 0, '#saveIncomingIpn should called zero times');
          assert.equal(self.saveFailedIpn.callCount, 5, '#saveFailedIpn should have been called 5 times');
          done();
        });

        const stub = sinon.stub();
        stub.withArgs(this.ipnData1.payloadJson).returns(reject(errors[0]));
        stub.withArgs(this.ipnData2.payloadJson).returns(reject(errors[1]));
        stub.withArgs(this.ipnData3.payloadJson).returns(reject(errors[2]));
        stub.withArgs(this.ipnData4.payloadJson).returns(reject(errors[3]));
        stub.withArgs(this.ipnData5.payloadJson).returns(reject(errors[4]));

        this.setProcessIpn(sinon.spy((payment, ipnData) => stub(ipnData)));

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });

      it('should call middleware\'s next if some notifications had problems sending event "paymentUpdated"', function (done) {
        const self = this;
        const errors = [];
        for (let i = 0; i < 5; i++) {
          errors.push(new Error(`problems propagating the ipn ${i}`));
        }

        this.setFailCallback((err) => {
          assert.equal(err.message, 'One or more ipns failed');
          assert.equal(_.size(err.context.errors), 5);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_1'), errors[0].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_2'), errors[1].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_3'), errors[2].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_4'), errors[3].message);
          assert.equal(_.get(err, 'context.errors.PAYMENT_REFERENCE_5'), errors[4].message);

          assert.equal(self.queueService.paymentUpdated.callCount, 5, '#queueService.paymentUpdated should called five times');
          assert.equal(self.processIpn.callCount, 5, '#processIpn should called five times');
          assert.equal(self.saveIncomingIpn.callCount, 5, '#saveIncomingIpn should called five times');
          assert.equal(self.saveFailedIpn.callCount, 5, '#saveFailedIpn should have been called five times');
          done();
        });

        this.setSuccessCallback(() => done(new Error('should not call try to send a response!')));

        const stub1 = sinon.stub();
        stub1.withArgs(this.ipnData1.payloadJson).returns(resolve({ propagate: true, payment: 0 }));
        stub1.withArgs(this.ipnData2.payloadJson).returns(resolve({ propagate: true, payment: 1 }));
        stub1.withArgs(this.ipnData3.payloadJson).returns(resolve({ propagate: true, payment: 2 }));
        stub1.withArgs(this.ipnData4.payloadJson).returns(resolve({ propagate: true, payment: 3 }));
        stub1.withArgs(this.ipnData5.payloadJson).returns(resolve({ propagate: true, payment: 4 }));
        this.setProcessIpn(sinon.spy((payment, ipnData) => stub1(ipnData)));

        const stub2 = sinon.stub();
        stub2.withArgs(0).returns(reject(errors[0]));
        stub2.withArgs(1).returns(reject(errors[1]));
        stub2.withArgs(2).returns(reject(errors[2]));
        stub2.withArgs(3).returns(reject(errors[3]));
        stub2.withArgs(4).returns(reject(errors[4]));
        this.setPaymentUpdated(sinon.spy(n => stub2(n)));

        this.gatewayController.processIpn(this.request, this.response, this.next);
      });
    });
  });

  describe('#parseIpn', () => {
    beforeEach(function () {
      this.request.body = {
        ipn: 'body',
        with: 'keys',
      };
    });

    it('should return a parsed ipn', function (done) {
      const self = this;
      const ipnData = [
        {
          payloadJson: { payload: 'en json' },
          client_reference: 'PAYMENT_REFERENCE',
        },
      ];

      this.setSuccessCallback((res) => {
        done(new Error('Should not call res.send'));
      });

      this.setParseIpnPayload(sinon.spy(() => {
        return resolve(ipnData);
      }));

      // Next function
      this.setFailCallback((err) => {
        if (err) {
          return done(err);
        }

        assert.equal(self.parseIpnPayload.callCount, 1);
        assert(self.parseIpnPayload.calledWith(self.request.body), '#parseIpnPayload should have been called with the original body');
        assert.equal(self.saveFailedIpn.callCount, 0, '#saveFailedIpn should not have been called');
        assert.equal(self.request.context.ipnData, ipnData);
        done();
      });

      this.gatewayController.parseIpn(this.request, this.response, this.next);
    });

    it('should fail if body is empty', function (done) {
      const self = this;

      delete this.request.body;

      this.setSuccessCallback((res) => {
        done(new Error('Should not call res.send'));
      });

      this.setParseIpnPayload(sinon.spy(() => {
        return resolve(ipnData);
      }));

      // Next function
      this.setFailCallback((err) => {
        if (!err) {
          return done(new Error('Should receive an error'));
        }

        assert.equal(err.message, 'Request body is empty');
        assert.equal(self.parseIpnPayload.callCount, 0);
        assert.equal(self.saveFailedIpn.callCount, 1, '#saveFailedIpn should have been called once');
        assert.isUndefined(self.request.context.ipnData);
        done();
      });

      this.gatewayController.parseIpn(this.request, this.response, this.next);
    });

    it('should fail if parseIpnPayload return a rejection', function (done) {
      const self = this;
      const error = new Error('Some parsing error');

      this.setSuccessCallback((res) => {
        done(new Error('Should not call res.send'));
      });

      this.setParseIpnPayload(sinon.spy(() => {
        return reject(error);
      }));

      // Next function
      this.setFailCallback((err) => {
        if (!err) {
          return done(new Error('Should receive an error'));
        }

        assert.equal(err, error);
        assert.equal(self.saveFailedIpn.callCount, 1, '#saveFailedIpn should have been called once');
        assert.isUndefined(self.request.context.ipnData);
        done();
      });

      this.gatewayController.parseIpn(this.request, this.response, this.next);
    });

    it('should fail if parsed ipn does not contain client_reference', function (done) {
      const self = this;
      const ipnData = [
        {
          payloadJson: { payload: 'en json' },
        },
      ];

      this.setSuccessCallback((res) => {
        done(new Error('Should not call res.send'));
      });

      this.setParseIpnPayload(sinon.spy(() => {
        return resolve(ipnData);
      }));

      // Next function
      this.setFailCallback((err) => {
        if (!err) {
          return done(new Error('Should receive an error'));
        }

        assert.equal(err.message, 'Could not extract client_reference from IPN');
        assert.equal(self.parseIpnPayload.callCount, 1);
        assert(self.parseIpnPayload.calledWith(self.request.body), '#parseIpnPayload should have been called with the original body');
        assert.equal(self.saveFailedIpn.callCount, 1, '#saveFailedIpn should have been called once');

        done();
      });

      this.gatewayController.parseIpn(this.request, this.response, this.next);
    });


    it('should call middleware\'s next with the original error if saveFailedIpn failed', function (done) {
      const self = this;

      delete this.request.body;

      this.setSuccessCallback((res) => {
        done(new Error('Should not call res.send'));
      });

      this.setSaveFailedIpn(sinon.spy(() => {
        return reject(new Error('Some save failed ipn error'));
      }));

      // Next function
      this.setFailCallback((err) => {
        if (!err) {
          return done(new Error('Should receive an error'));
        }

        assert.equal(err.message, 'Request body is empty');
        assert.equal(self.parseIpnPayload.callCount, 0);
        assert.equal(self.saveFailedIpn.callCount, 1, '#saveFailedIpn should have been called once');
        done();
      });

      this.gatewayController.parseIpn(this.request, this.response, this.next);
    });

    it('should generate a success response if recives a SkipIpnError', function (done) {
      const self = this;

      this.setParseIpnPayload(() => {
        return Promise.reject(new errors.SkipIpnError());
      });

      this.setSuccessCallback((res) => {
        done();
      });

      this.setSaveFailedIpn(sinon.spy(() => {
        return done(new Error('Should not call saveFailedIpn'));
      }));

      // Next function
      this.setFailCallback((err) => {
        done(new Error('Should not call next function'));
      });

      this.gatewayController.parseIpn(this.request, this.response, this.next);
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
