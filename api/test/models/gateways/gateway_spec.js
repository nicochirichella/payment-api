'use strict';

const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const Gateway = require('../../../src/models/gateway.js');
const GatewayMethod = require('../../../src/models/gateway_method.js');
const Tenant = require('../../../src/models/tenant');
const Payment = require('../../../src/models/payment.js');
const errors = require('../../../src/errors');
const PaymentStatus = require('../../../src/models/constants/payment_status.js');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const Promise = require('bluebird');

describe('#Gateway', () => {

  describe('#processAuthorizeResponse', () => {
    let gateway,
      payment;

    beforeEach(() => {
      gateway = new Gateway();
      payment = new Payment({
        currency: 'CUR',
        amount: 34.20,
        type: 'creditCard',
        client_reference: '0123-payment-ref',
        status_id: 'pendingAuthorize',
        gateway_method_id: 1,
        tenant_id: 3,
      });
    });

    it('should correctly parse a response when recognize status and status detail from gateway', () => {
      gateway.translateAuthorizeStatus = sinon.spy(() => resolve(PaymentStatus.chargedBack));
      gateway.translateAuthorizeStatusDetail = sinon.spy(() => resolve(PaymentStatusDetail.ok));

      return expect(gateway.processAuthorizeResponse(payment, {}))
        .to.be.fulfilled
        .then((resp) => {
          assert.deepEqual(resp, {
            status: PaymentStatus.chargedBack,
            statusDetail: PaymentStatusDetail.ok,
          });
        });
    });

    it('should correctly parse a response if translateAuthorizeStatus returns NoMatchingStatusError', () => {
      gateway.translateAuthorizeStatus = sinon.spy(() => reject(new errors.NoMatchingStatusError('unknown errors')));
      gateway.translateAuthorizeStatusDetail = sinon.spy(() => resolve(PaymentStatusDetail.ok));

      return expect(gateway.processAuthorizeResponse(payment, {}))
        .to.be.fulfilled
        .then((resp) => {
          assert.deepEqual(resp, {
            status: PaymentStatus.pendingAuthorize,
            statusDetail: PaymentStatusDetail.ok,
          });
        });
    });

    it('should correctly parse a response if translateAuthorizeStatusDetail returns NoMatchingStatusError', () => {
      gateway.translateAuthorizeStatus = sinon.spy(() => resolve(PaymentStatus.cancelled));
      gateway.translateAuthorizeStatusDetail = sinon.spy(() => reject(new errors.NoMatchingStatusError('unknown errors')));

      return expect(gateway.processAuthorizeResponse(payment, {}))
        .to.be.fulfilled
        .then((resp) => {
          assert.deepEqual(resp, {
            status: PaymentStatus.cancelled,
            statusDetail: PaymentStatusDetail.unknown,
          });
        });
    });

    it('should correctly parse a response if translateAuthorizeStatusDetail and translateAuthorizeStatus returns NoMatchingStatusError', () => {
      gateway.translateAuthorizeStatus = sinon.spy(() => reject(new errors.NoMatchingStatusError('unknown errors')));
      gateway.translateAuthorizeStatusDetail = sinon.spy(() => reject(new errors.NoMatchingStatusError('unknown errors')));

      return expect(gateway.processAuthorizeResponse(payment, {}))
        .to.be.fulfilled
        .then((resp) => {
          assert.deepEqual(resp, {
            status: PaymentStatus.pendingAuthorize,
            statusDetail: PaymentStatusDetail.unknown,
          });
        });
    });

    it('should return a rejected promise if translateAuthorizeStatus fails with an error different from NoMatchingStatusError', () => {
      const error = new Error('Some random error');

      gateway.translateAuthorizeStatus = sinon.spy(() => reject(error));
      gateway.translateAuthorizeStatusDetail = sinon.spy(() => resolve(PaymentStatusDetail.card_in_blacklist));

      return expect(gateway.processAuthorizeResponse(payment, {}))
        .to.be.rejectedWith(error);
    });

    it('should return a rejected promise if translateAuthorizeStatusDetail fails with an error different from NoMatchingStatusError', () => {
      const error = new Error('Some random error');

      gateway.translateAuthorizeStatus = sinon.spy(() => resolve(PaymentStatus.cancelled));
      gateway.translateAuthorizeStatusDetail = sinon.spy(() => reject(error));

      return expect(gateway.processAuthorizeResponse(payment, {}))
        .to.be.rejectedWith(error);
    });

    it('should return the first rejected promise to fail when translateAuthorizeStatusDetail and translateAuthorizeStatus fails with an error different from NoMatchingStatusError', () => {
      const error1 = new Error('Some random error');
      const error2 = new Error('Some other random error');

      gateway.translateAuthorizeStatus = sinon.spy(() => reject(error1));
      gateway.translateAuthorizeStatusDetail = sinon.spy(() => reject(error2));

      return expect(gateway.processAuthorizeResponse(payment, {}))
        .to.be.rejected
        .then((err) => {
          if (err !== error1 && err !== error2) {
            assert.fail();
          }
        });
    });
  });

  describe('#sendPayment', () => {
    let gateway,
      payment,
      requestInfo;

    beforeEach(() => {
      gateway = new Gateway();
      payment = new Payment({
        currency: 'CUR',
        amount: 34.20,
        type: 'creditCard',
        client_reference: '0123-payment-ref',
        status_id: 'pendingAuthorize',
        gateway_method_id: 1,
        tenant_id: 3,
      });

      requestInfo = {
        installments: 6,
        amountInCents: 60000,

        gatewayMethod: 'GM_ONE',
        type: 'creditCard',
        paymentInformation: {
          processor: 'visa',
          lastFourDigits: 1234,
          firstSixDigits: 123456,
        },

        currency: 'BRL',
        client_reference: 'CLIENT_REFERENCE',

        encryptedCreditCards: [{
          encryptedContent: 'CARDTOKEN',
          encryptionType: 'mercadopagoToken',
        }],
      };
    });

    it('should correctly build a response if createPayment returns a valid response', () => {
      const gatewayReference = 'GatewayReference';
      const metadata = {
        mercadoPagoId: 'GatewayReference',
        collectorId: 100000000,
        issuerId: '10',
        authorizationCode: 1234,
      };
      const paymentInformation = {};

      gateway.createPayment = sinon.spy(() => createMockPaymentCreationResponse());
      gateway.processAuthorizeResponse = sinon.spy(() => resolve({
        status: PaymentStatus.successful,
        statusDetail: PaymentStatusDetail.ok,
      }));
      gateway.extractGatewayReference = sinon.spy(() => gatewayReference);
      gateway.buildMetadata = sinon.spy(() => metadata);
      gateway.buildPaymentInformation = sinon.spy(() => paymentInformation);
      gateway.extractRedirectUrl = sinon.spy(() => 'www.google.com');
      gateway.retrier = require('../../../src/models/payment_retriers/null_retrier');

      return expect(gateway.sendPayment(payment, requestInfo, null))
        .to.be.fulfilled
        .then((resp) => {
          assert.deepEqual(resp, {
            paymentStatus: PaymentStatus.successful,
            installments: 6,
            gatewayReference,
            metadata,
            statusDetail: PaymentStatusDetail.ok,
            success: true,
            paymentInformation: null,
            redirectUrl: 'www.google.com',
            shouldRetry: false,
          });
        });
    });

    it('should fail if processAuthorizeResponse fails', () => {
      const err = new Error('A generic error');
      gateway.createPayment = sinon.spy(() => createMockPaymentCreationResponse());
      gateway.processAuthorizeResponse = sinon.spy(() => reject(err));
      gateway.extractGatewayReference = sinon.spy();
      gateway.buildMetadata = sinon.spy();

      return expect(gateway.sendPayment(payment, requestInfo, null))
        .to.be.rejectedWith(err);
    });

    it('should fail if createPayment fails', (done) => {
      gateway.createPayment = sinon.spy(() => reject());
      gateway.translateAuthorizeStatus = sinon.spy();
      gateway.translateAuthorizeStatusDetail = sinon.spy();
      gateway.extractGatewayReference = sinon.spy();
      gateway.buildMetadata = sinon.spy();

      return expect(gateway.sendPayment(payment, requestInfo, null))
        .to.be.rejected
        .then((err) => {
          assert(gateway.createPayment.calledOnce);
          assert(!gateway.translateAuthorizeStatus.called);
          assert(!gateway.translateAuthorizeStatusDetail.called);
          assert(!gateway.extractGatewayReference.called);
          assert(!gateway.buildMetadata.called);

          done();
        });
    });
  });

  describe('#processIpnRequest', () => {
    let gateway,
      payment,
      requestInfo;

    beforeEach(() => {
      gateway = new Gateway();
      payment = new Payment({
        currency: 'CUR',
        amount: 34.20,
        type: 'creditCard',
        client_reference: '0123-payment-ref',
        status_id: 'pendingAuthorize',
        gateway_method_id: 1,
        tenant_id: 3,
      });
    });

    it('should process correctly and return translated statuses', () => {
      gateway.translateIpnStatus = sinon.spy(() => resolve(PaymentStatus.pendingAuthorize));
      gateway.translateIpnStatusDetail = sinon.spy(() => resolve(PaymentStatusDetail.pending));

      return gateway.processIpnRequest(payment, {})
        .then((result) => {
          assert.deepEqual(result, {
            status: PaymentStatus.pendingAuthorize,
            statusDetail: PaymentStatusDetail.pending,
          });
        });
    });

    it('should reject the promise with SkipIpnError if translateIpnStatus reject with NoMatchingStatusError', () => {
      gateway.translateIpnStatus = sinon.spy(() => reject(new errors.NoMatchingStatusError('status')));
      gateway.translateIpnStatusDetail = sinon.spy(() => resolve(PaymentStatusDetail.pending));

      return expect(gateway.processIpnRequest(payment, {}))
        .to.be.rejectedWith(errors.SkipIpnError);
    });

    it('should fulfill the promise with PaymentSatusDetail if translateIpnStatusDetail reject with NoMatchingStatusError', () => {
      gateway.translateIpnStatus = sinon.spy(() => resolve(PaymentStatus.pendingAuthorize));
      gateway.translateIpnStatusDetail = sinon.spy(() => reject(new errors.NoMatchingStatusError('status')));

      return gateway.processIpnRequest(payment, {})
        .then((result) => {
          assert.deepEqual(result, {
            status: PaymentStatus.pendingAuthorize,
            statusDetail: PaymentStatusDetail.unknown,
          });
        });
    });

    it('should reject the promise with SkipIpnError if translateIpnStatus and translateIpnStatusDetail reject with NoMatchingStatusError', () => {
      gateway.translateIpnStatus = sinon.spy(() => reject(new errors.NoMatchingStatusError('status_other')));
      gateway.translateIpnStatusDetail = sinon.spy(() => reject(new errors.NoMatchingStatusError('status')));

      return expect(gateway.processIpnRequest(payment, {}))
        .to.be.rejectedWith(errors.SkipIpnError);
    });

    it('should reject the promise if translateIpnStatus reject with a different error than NoMatchingStatusError', () => {
      const err = new Error('unknown error');

      gateway.translateIpnStatus = sinon.spy(() => reject(err));
      gateway.translateIpnStatusDetail = sinon.spy(() => resolve(PaymentStatusDetail.pending));

      return expect(gateway.processIpnRequest(payment, {}))
        .to.be.rejectedWith(err);
    });

    it('should reject the promise if translateIpnStatusDetail and reject with a different error than NoMatchingStatusError', () => {
      const err = new Error('unknown error');

      gateway.translateIpnStatus = sinon.spy(() => resolve(PaymentStatus.pendingAuthorize));
      gateway.translateIpnStatusDetail = sinon.spy(() => reject(err));

      return expect(gateway.processIpnRequest(payment, {}))
        .to.be.rejectedWith(err);
    });

    it('should  return the first rejected promise to fail when translateIpnStatusDetail and translateIpnStatus fails with an error different from NoMatchingStatusError', () => {
      const error1 = new Error('unknown error');
      const error2 = new Error('other unknown error');

      gateway.translateIpnStatus = sinon.spy(() => reject(error1));
      gateway.translateIpnStatusDetail = sinon.spy(() => reject(error2));

      return expect(gateway.processIpnRequest(payment, {}))
        .to.be.rejected
        .then((err) => {
          if (err !== error1 && err !== error2) {
            assert.fail();
          }
        });
    });
  });

  describe('#extractRedirectUrl', () => {
    it('should return null because this is the base implementation', () => {
      const gateway = new Gateway();
      assert.isNull(gateway.extractRedirectUrl({}));
    });
  });

  describe('#processIpn', () => {
    const context = {};

    beforeEach(() => {
      context.gateway = new Gateway();
      context.gatewayMethod = new GatewayMethod();

      context.payment = new Payment({
        currency: 'CUR',
        amount: 34.20,
        type: 'creditCard',
        client_reference: 'payment-ref',
        status_id: PaymentStatus.pendingAuthorize,
        status_detail: PaymentStatusDetail.pending,
        gateway_method_id: 1,
        tenant_id: 1,
      });

      context.payment.related = () => context.gatewayMethod;
      context.payment.relations['gatewayMethod'] = context.gatewayMethod;

    });

    it('should process and save the IPN correctly', () => {
      context.gateway.processIpnRequest = sinon.spy(() => resolve({
        status: PaymentStatus.pendingAuthorize,
        statusDetail: PaymentStatusDetail.pending,
      }));

      context.gatewayMethod.saveIpnResult = sinon.spy(() => resolve({
        payment: context.payment,
        propagate: true,
      }));

      return context.gateway.processIpn(context.payment, {
        some: 'payload',
      })
        .then((r) => {
          assert.deepEqual(r, {
            propagate: true,
            payment: context.payment,
          });
        });
    });

    it('should not propagate and not saveIpnResult if processIpnRequest throws a SkipIpnError', () => {
      context.gateway.processIpnRequest = sinon.spy(() => reject(new errors.SkipIpnError()));

      context.gatewayMethod.saveIpnResult = sinon.spy(() => resolve({
        payment: context.payment,
        propagate: true,
      }));

      return context.gateway.processIpn(context.payment, {
        some: 'payload',
      })
        .then((r) => {
          assert.deepEqual(r, {
            propagate: false,
            payment: context.payment,
          });
          assert.equal(context.gatewayMethod.saveIpnResult.callCount, 0, 'gatewayMethod.saveIpnResult should not be called');
        });
    });

    it('should return a rejected promise and not saveIpnResult if processIpnRequest throws a different error than SkipIpnError', () => {
      const err = new Error('Some error');
      context.gateway.processIpnRequest = sinon.spy(() => reject(err));

      context.gatewayMethod.saveIpnResult = sinon.spy(() => resolve({
        payment: context.payment,
        propagate: true,
      }));

      return expect(context.gateway.processIpn(context.payment, {
        some: 'payload',
      }))
        .to.be.rejectedWith(err)
        .then(() => {
          assert.equal(context.gatewayMethod.saveIpnResult.callCount, 0, 'gatewayMethod.saveIpnResult should not be called');
        });
    });

    it('should return a rejected promise if saveIpnResult throws an error', () => {
      const err = new Error('Some error');
      context.gateway.processIpnRequest = sinon.spy(() => resolve({
        status: PaymentStatus.pendingAuthorize,
        statusDetail: PaymentStatusDetail.pending,
      }));

      context.gatewayMethod.saveIpnResult = sinon.spy(() => reject(err));

      return expect(context.gateway.processIpn(context.payment, {
        some: 'payload',
      }))
        .to.be.rejectedWith(err);
    });
  });

  describe('#processIpnProcessAction', () => {
    const context = {};

    beforeEach(() => {
      context.gateway = new Gateway();
      context.gatewayMethod = new GatewayMethod();

      context.payment = new Payment({
        currency: 'CUR',
        amount: 34.20,
        type: 'creditCard',
        client_reference: 'payment-ref',
        status_id: PaymentStatus.pendingAuthorize,
        status_detail: PaymentStatusDetail.pending,
        gateway_method_id: 1,
        tenant_id: 1,
      });

      context.payment.related = () => context.gatewayMethod;
      context.payment.relations['gatewayMethod'] = context.gatewayMethod;

    });

    it('should call the postIpnProcessAction on the gatewayMethod of the payment and return its result', () => {
      context.gatewayMethod.postIpnProcessAction = sinon.spy(() => resolve({}));

      const resolvedStatusesMock = {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.other
      };

      const ipnDataMock = {
        some: 'payload',
      };

      return expect(context.gateway.postIpnProcessAction(context.payment, ipnDataMock, resolvedStatusesMock, PaymentStatus.rejected))
        .to.be.fulfilled.then(() => {
          return expect(context.gatewayMethod.postIpnProcessAction.called).to.eql(true);
        });
    });

    it('should call the postIpnProcessAction on the gatewayMethod of the payment and return its error if rejected', () => {
      const error = new Error('problemWithAction');
      context.gatewayMethod.postIpnProcessAction = sinon.spy(() => reject(error));

      const resolvedStatusesMock = {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.other
      };

      const ipnDataMock = {
        some: 'payload',
      };

      return expect(context.gateway.postIpnProcessAction(context.payment, ipnDataMock, resolvedStatusesMock, PaymentStatus.rejected))
        .to.be.rejectedWith(error)
    });

    it('should not propagate and not saveIpnResult if processIpnRequest throws a SkipIpnError', () => {
      context.gateway.processIpnRequest = sinon.spy(() => reject(new errors.SkipIpnError()));

      context.gatewayMethod.saveIpnResult = sinon.spy(() => resolve({
        payment: context.payment,
        propagate: true,
      }));

      return context.gateway.processIpn(context.payment, {
        some: 'payload',
      })
        .then((r) => {
          assert.deepEqual(r, {
            propagate: false,
            payment: context.payment,
          });
          assert.equal(context.gatewayMethod.saveIpnResult.callCount, 0, 'gatewayMethod.saveIpnResult should not be called');
        });
    });

    it('should return a rejected promise and not saveIpnResult if processIpnRequest throws a different error than SkipIpnError', () => {
      const err = new Error('Some error');
      context.gateway.processIpnRequest = sinon.spy(() => reject(err));

      context.gatewayMethod.saveIpnResult = sinon.spy(() => resolve({
        payment: context.payment,
        propagate: true,
      }));

      return expect(context.gateway.processIpn(context.payment, {
        some: 'payload',
      }))
        .to.be.rejectedWith(err)
        .then(() => {
          assert.equal(context.gatewayMethod.saveIpnResult.callCount, 0, 'gatewayMethod.saveIpnResult should not be called');
        });
    });

    it('should return a rejected promise if saveIpnResult throws an error', () => {
      const err = new Error('Some error');
      context.gateway.processIpnRequest = sinon.spy(() => resolve({
        status: PaymentStatus.pendingAuthorize,
        statusDetail: PaymentStatusDetail.pending,
      }));

      context.gatewayMethod.saveIpnResult = sinon.spy(() => reject(err));

      return expect(context.gateway.processIpn(context.payment, {
        some: 'payload',
      }))
        .to.be.rejectedWith(err);
    });
  });
});

let createMockPaymentCreationResponse = (status, statusDetail) => {
  const responseData = require('../../fixtures/paymentCreationResponse/mercadopago_cc.json');

  if (arguments.length !== 0) {
    _.set(responseData, 'data.status', status);
  }
  if (arguments.length == 2) {
    _.set(responseData, 'data.status_detail', statusDetail);
  }
  return resolve(responseData);
};

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
