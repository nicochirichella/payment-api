'use strict';

const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const nock = require('nock');
const PaymentStatus = require('../../../src/models/constants/payment_status');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const errors = require('../../../src/errors.js');
const Payment = require('../../../src/models/payment');
const ApiClient = require('../../../src/services/api_client');
const mockery = require('mockery');
const PaymentType = require('../../../src/models/constants/payment_type');
const stubs = require('../../stubs');
const helpers = require('../../helpers');
const Promise = require('bluebird');
const moment = require('moment');
const url = require('url');
const querystring = require('querystring');

let Gateway;
let knex;
let paymentMock;

const fixtures = {
  paymentCreationOutgoingRequestPerson: require('../../fixtures/outgoing_requests/paypal_payment_creation_person.json'),
  paymentCreationOutgoingRequestCompany: require('../../fixtures/outgoing_requests/paypal_payment_creation_company.json'),
  paymentCreationResponse: require('../../fixtures/paymentCreationResponse/paypal.json'),
  paymentExecutionSuccessResponse: require('../../fixtures/otherPaymentResponses/paypal_execute_success.json'),
  paymentExecutionFailureResponse: require('../../fixtures/otherPaymentResponses/paypal_execute_failure.json'),
  gatewayRequestMock: require('../../fixtures/gatewayRequestMocks/paypal.json'),
  antiFraudOutgoingRequest: require('../../fixtures/outgoing_requests/paypal_anti_fraud.json'),
  executeOutgoingRequest: require('../../fixtures/outgoing_requests/paypal_execute.json'),
  ipnPayload: require('../../fixtures/ipns/paypal.json'),
  disputeIpnPayload: require('../../fixtures/ipns/paypal_dispute.json'),
  deprecatedInMediationIpnPayload: require('../../fixtures/ipns/paypal_deprecated_in_mediation.json'),
};


describe('#Gateways :: Paypal', () => {
  let paypal;

  before(() => {
    /*
         mockery.enable({
         warnOnUnregistered: false,
         useCleanCache: false
         });
         mockery.registerMock('../../services/token_manager', stubs.tokenManager);

         */
  });

  beforeEach(() => {
    knex = require('../../../src/bookshelf').knex;
    Gateway = require('../../../src/models/gateway');
    return knex('gateways').insert({
      id: 1,
      tenant_id: 1,
      type: 'PAYPAL',
      name: 'Paypal',
      base_url: 'https://base.url.com',
      created_at: new Date(),
      updated_at: new Date(),
    }).then(() => {
      return Gateway.forge({ id: 1 }).fetch();
    }).then((gateway) => {

      paypal = gateway;
      const modelGet = paypal.get;
      sinon.stub(paypal, 'get', function (key) {
        if (key === 'keys') {
          return {
            walletSecrets: {
              clientId: 'WALLET_CLIENT_ID',
              clientSecret: 'WALLET_CLIENT_SECRET',
              merchantId: 'WALLET_MERCHANT_ID',
            },
            ccSecrets: {
              clientId: 'CC_CLIENT_ID',
              clientSecret: 'CC_CLIENT_SECRET',
              merchantId: 'CC_MERCHANT_ID',
            },
            checkoutUrl: 'https://checkout.url.com',
            refreshTokenUrl: 'https://refresh-token.url.com',
          };
        }

        return modelGet.apply(this, arguments);

      });
      sinon.stub(paypal, 'getToken').returns(Promise.resolve('TOKEN'));
    });
  });

  beforeEach(() => {
    return helpers.createPaymentMock({
      cancelUrl: 'www.cancelUrl.com',
      saleId: '8MH73947JT871392J',
    }, {
      cancelUrl: 'www.cancelUrl.com',
    }).then((payment) => {
      paymentMock = payment;
    });
  });


  after(() => {
    mockery.deregisterMock('../../services/token_manager');
    mockery.disable();
  });

  describe('#getClient', () => {

    it('should return an apiClient with the given token', () => {

      const expectedApiClient = new ApiClient('https://base.url.com', {
        headers: {
          authorization: 'Bearer ' + 'TOKEN',
        },
      });

      return expect(paypal.getClient(PaymentType.paypal))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response.config, expectedApiClient.config);
          assert.deepEqual(response.baseUrl, expectedApiClient.baseUrl);
        });

    });

    it('should return a rejected promise if the token cannot be found', () => {

      const error = new Error('Error gathering token');

      paypal.getToken.restore();
      sinon.stub(paypal, 'getToken').returns(Promise.reject(error));

      return expect(paypal.getClient('wallet'))
        .to.be.rejectedWith(error);
    });

  });

  describe('#getBaseKey', () => {
    it('should return \'walletSecrets.\' for paypal payment type', () => {
      return assert.equal(paypal.getBaseKey(PaymentType.paypal), 'walletSecrets.');
    });

    it('should return \'ccSecrets.\' for paypal payment type', () => {
      return assert.equal(paypal.getBaseKey(PaymentType.creditCard), 'ccSecrets.');
    });

    it('should return an unexpectedKeyname internal server error for an unknown payment type', () => {
      try {
        paypal.getBaseKey('unknownPaymentType');
      } catch (err) {
        assert.equal(err.code, 'internal_server_error');
        assert.deepEqual(err.context, {
          paymentType: 'unknownPaymentType', gateway: 'Paypal',
        });
      }
    });
  });

  describe('#getMerchantId', () => {
    it('should return the wallet merchant id for paypal payment type', () => {
      return assert.equal(paypal.getMerchantId(PaymentType.paypal), 'WALLET_MERCHANT_ID');
    });
    it('should return the credit card merchant id for creditcard payment type', () => {
      return assert.equal(paypal.getMerchantId(PaymentType.creditCard), 'CC_MERCHANT_ID');
    });
    it('should return an unexpectedKeyname internal server error for an unknown payment type', () => {
      try {
        paypal.getMerchantId('unknownPaymentType');
      } catch (err) {
        assert.equal(err.code, 'internal_server_error');
        assert.deepEqual(err.context, {
          paymentType: 'unknownPaymentType', gateway: 'Paypal',
        });
      }
    });
  });

  /* Doesn't make sense to mock getToken because i'm mocking the whole method */

  /*
     describe('#getToken', function () {
     it('should return a fulfilled promise with the correct access token', function () {
     return expect(paypal.getToken(PaymentType.paypal))
     .to.be.fulfilled
     .then((response) => {
     assert.equal(response, 'TOKEN');
     })
     });
     it('should return the credit card merchant id for creditcard payment type', function () {
     return expect(paypal.getToken(PaymentType.creditCard))
     .to.be.fulfilled
     .then((response) => {
     assert.equal(response, 'TOKEN');
     })
     });
     it('should return an unexpectedKeyname internal server error for an unknown payment type', function () {
     return expect(paypal.getToken('unknown'))
     .to.be.rejected;
     });
     })
     */


  describe('#createPayment', () => {

    beforeEach(() => {
      sinon.stub(paypal, 'sendAntiFraudData').returns(Promise.resolve());
    });

    it('should make a post to the paypal payments url and return the body of the gateway response if it was a 200', () => {
      const request = nock('https://base.url.com')
        .post('/payments/payment', (body) => {
          return _.isEqual(body, fixtures.paymentCreationOutgoingRequestPerson);
        })
        .reply(200, fixtures.paymentCreationResponse.data);

      return paypal.createPayment(paymentMock, fixtures.gatewayRequestMock, {})
        .then((resp) => {
          assert.deepEqual(resp.body, fixtures.paymentCreationResponse.data);
          request.done();
        });
    });

    it('should return a rejected promise if call with all the parameters and receive a 400', () => {
      const request = nock('https://base.url.com')
        .post('/payments/payment', (body) => {
          return _.isEqual(body, fixtures.paymentCreationOutgoingRequestPerson);
        })
        .reply(400, {});

      return expect(paypal.createPayment(paymentMock, fixtures.gatewayRequestMock, {})).to.be.rejected
        .then(() => {
          request.done();
        });
    });

    it('should return a rejected promise if call with all the parameters and receive a 500', () => {
      const request = nock('https://base.url.com')
        .post('/payments/payment', (body) => {
          return _.isEqual(body, fixtures.paymentCreationOutgoingRequestPerson);
        })
        .reply(500, {});

      return expect(paypal.createPayment(paymentMock, fixtures.gatewayRequestMock, {})).to.be.rejected
        .then(() => {
          request.done();
        });
    });

    it('should return a rejected promise if the antiFraud data request is rejected for some reason', function () {
      const request = nock('https://base.url.com')
        .post('/payments/payment', (body) => {
          return _.isEqual(body, fixtures.paymentCreationOutgoingRequestPerson)
        })
        .reply(500, {});

      paypal.sendAntiFraudData = () => Promise.reject(new Error('fail'));

      return expect(paypal.createPayment(paymentMock, fixtures.gatewayRequestMock, {})).to.be.rejected
        .then(() => {
          request.done();
        });
    });
  });

  describe('#sendAntiFraudData', () => {

    it('should make a post to the paypal anti fraud url and return the body of the gateway response if it was a 200', () => {
      const request = nock('https://base.url.com')
        .put('/risk/transaction-contexts/CC_MERCHANT_ID/PAY-8KR674868H750523LLJL2RUQ', (body) => {
          const expectedResponse = fixtures.antiFraudOutgoingRequest;
          const senderCreateDateIndex = _.findIndex(fixtures.antiFraudOutgoingRequest.additional_data, { key: 'sender_create_date' });
          fixtures.antiFraudOutgoingRequest.additional_data[senderCreateDateIndex].value = moment().format('DD/MM/YYYY');
          return _.isEqual(body, fixtures.antiFraudOutgoingRequest);
        })
        .reply(200, fixtures.paymentCreationResponse.data);

      const gatewayReference = paypal.extractGatewayReference(fixtures.paymentCreationResponse);
      return paypal.sendAntiFraudData(paymentMock, gatewayReference)
        .then((resp) => {
          request.done();
        });
    });

    it('should return a resolved promise and continue executing normally even if the request fails', () => {
      const request = nock('https://base.url.com')
        .put('/risk/transaction-contexts/CC_MERCHANT_ID/PAY-8KR674868H750523LLJL2RUQ', (body) => {
          return _.isEqual(body, fixtures.antiFraudOutgoingRequest);
        })
        .reply(500, {});

      const gatewayReference = paypal.extractGatewayReference(fixtures.paymentCreationResponse);
      return expect(paypal.sendAntiFraudData(paymentMock, gatewayReference)).to.be.fulfilled
        .then(() => {
          request.done();
        });
    });
  });

  describe('#getInstallments', () => {

    it('should return the current installments if the payment already has installments', () => {
      return paypal.getInstallments(paymentMock)
        .then((installments) => {
          assert.equal(installments, 8);
        });
    });

    it('should return fetch the installments from the gateway if the payment has null installments', () => {
      paymentMock.set('installments', null);
      const request = nock('https://base.url.com')
        .get('/payments/payment/mpMockId')
        .reply(200, fixtures.paymentCreationResponse.data);

      return paypal.getInstallments(paymentMock, fixtures.gatewayRequestMock, {})
        .then((resp) => {
          assert.equal(resp, 10);
          request.done();
        });
    });

    it('should return fetch the installments from the gateway if the payment has null installments, and successfully return null if fails', () => {
      paymentMock.set('installments', null);
      const request = nock('https://base.url.com')
        .get('/payments/payment/mpMockId')
        .reply(400, {});

      return paypal.getInstallments(paymentMock, fixtures.gatewayRequestMock, {})
        .then((resp) => {
          assert.equal(resp, null);
          request.done();
        });
    });
  });

  describe('#executePayment', () => {

    it('should make a request to execute url and return the correct success response object if gateway responds with a 200', () => {

      sinon.stub(paypal, 'sendAntiFraudData', () => {
        return Promise.resolve();
      });

      sinon.stub(paypal, 'getInstallments', () => {
        return Promise.resolve(12);
      });

      const request = nock('https://base.url.com')
        .post('/payments/payment/mpMockId/execute', (body) => {
          return _.isEqual(body, fixtures.executeOutgoingRequest);
        })
        .reply(200, fixtures.paymentExecutionSuccessResponse.data);

      return paypal.executePayment(paymentMock, {
        payerId: 'PAYER_ID',
      })
        .then((resp) => {
          assert.deepEqual(resp, {
            pending: false,
            saleId: '8MH73947JT871392J',
            status: PaymentStatus.successful,
            statusDetail: PaymentStatusDetail.ok,
            installments: 12,
          });
          request.done();
        });
    });

    it('should make a request to execute url and return the correct reject response object if gateway responds with a 400', () => {

      sinon.stub(paypal, 'sendAntiFraudData', () => {
        return Promise.resolve();
      });

      sinon.stub(paypal, 'getInstallments', () => {
        return Promise.resolve(12);
      });

      const request = nock('https://base.url.com')
        .post('/payments/payment/mpMockId/execute', (body) => {
          return _.isEqual(body, fixtures.executeOutgoingRequest);
        })
        .reply(400, fixtures.paymentExecutionFailureResponse.data);

      return paypal.executePayment(paymentMock, {
        payerId: 'PAYER_ID',
      })
        .then((resp) => {
          assert.deepEqual(resp, {
            pending: false,
            saleId: null,
            status: PaymentStatus.rejected,
            statusDetail: PaymentStatusDetail.no_funds,
            installments: 12,
          });
          request.done();
        });
    });

    it('should make a request to execute url and throw a fail response error if gateway responds with a 500', () => {

      sinon.stub(paypal, 'sendAntiFraudData', () => {
        return Promise.resolve();
      });

      sinon.stub(paypal, 'getInstallments', () => {
        return Promise.resolve(12);
      });

      const error = new errors.FailResponseError('err');

      const request = nock('https://base.url.com')
        .post('/payments/payment/mpMockId/execute', (body) => {
          return _.isEqual(body, fixtures.executeOutgoingRequest);
        })
        .reply(500, fixtures.paymentExecutionFailureResponse.data);

      return expect(paypal.executePayment(paymentMock, {
        payerId: 'PAYER_ID',
      })).to.be.rejected.then((err) => {
        assert.equal(err.code, 'paypal_request_has_errors');
        assert.equal(err.status, 400);
        request.done();
      });

    });

  });


  describe('#refundPayment', () => {

    it('should make a request to refund url and return a fulfilled promise if gateway responds with a 200', () => {

      const request = nock('https://base.url.com')
        .post('/payments/sale/8MH73947JT871392J/refund')
        .reply(200, {});

      return paypal.refundPayment(paymentMock)
        .then((resp) => {
          assert.deepEqual(resp, {
            pending: false,
          });
          request.done();
        });
    });

    it('should make a request to refund url and return a rejected promise if gateway responds with a non 200', () => {

      const request = nock('https://base.url.com')
        .post('/payments/sale/8MH73947JT871392J/refund')
        .reply(400, {});

      return expect(paypal.refundPayment(paymentMock)).to.be.rejected.then((err) => {
        assert.equal(err.code, 'paypal_request_has_errors');
        assert.equal(err.status, 400);
        request.done();
      });
    });

  });

  describe('#parseIpnPayload', () => {

    it('should return a rejected promise with the correct error if it cannot extract the parent_payment from the webhook', () => {
      const malformedIpnPayload = {
        perritos: ['kerni'],
      };

      return expect(paypal.parseIpnPayload(malformedIpnPayload, {
        type: PaymentType.creditCard,
      })).to.be.rejected.then((err) => {
        assert.equal(err.code, 'bad_request');
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Webhook does not contain payment id');
      });

    });

    it('should return a rejected promise with the correct error if the url of the webook did not contain the type query param', () => {
      return expect(paypal.parseIpnPayload(fixtures.ipnPayload, {
        type: null,
      })).to.be.rejected.then((err) => {
        assert.equal(err.code, 'bad_request');
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Query param type missing or not valid');
      });

    });

    it('should return a rejected promise with the correct error if the url of the webook contained a unknown type query param', () => {
      return expect(paypal.parseIpnPayload(fixtures.ipnPayload, {
        type: 'spicesFromIndia',
      })).to.be.rejected.then((err) => {
        assert.equal(err.code, 'bad_request');
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Query param type missing or not valid');
      });

    });


    it('should return a rejected promise with SkipIpnError if receives a RISK.DISPUTE.CREATED event', () => {
      return expect(paypal.parseIpnPayload(fixtures.deprecatedInMediationIpnPayload, {
        type: PaymentType.creditCard,
      })).to.be.rejectedWith(errors.SkipIpnError);
    });

    it('should make a request to payment url and return a resolved promise with the correct object if gateway responds with a 200 and valid response', () => {

      const request = nock('https://base.url.com')
        .get('/payments/payment/PAY-8KR674868H750523LLJL2RUQ')
        .reply(200, fixtures.paymentCreationResponse.data);

      return paypal.parseIpnPayload(fixtures.ipnPayload, {
        type: PaymentType.creditCard,
      })
        .then((resp) => {
          assert.deepEqual(resp, [{
            client_reference: 'PAYMENT_REFERENCE_1',
            payloadJson: {
              ipnPayload: fixtures.ipnPayload,
            },
          }]);
          request.done();
        });

    });

    it('should return a rejected promise with the correct error if the ipn is a dispute ipn but client_reference is not found', () => {


      const malformedDisputeIpnPayload = _.cloneDeep(fixtures.disputeIpnPayload);
      malformedDisputeIpnPayload.resource.disputed_transactions[0] = {};

      return expect(paypal.parseIpnPayload(malformedDisputeIpnPayload, {
        type: PaymentType.creditCard,
      })).to.be.rejected.then((err) => {
        assert.equal(err.code, 'bad_request');
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Dispute webhook does not contain client_reference');
      });

    });


    it('should correctly extract the client_reference if the ipn is a dispute ipn and the client_reference is not found', () => {

      return paypal.parseIpnPayload(fixtures.disputeIpnPayload, {
        type: PaymentType.creditCard,
      })
        .then((resp) => {
          assert.deepEqual(resp, [{
            client_reference: 'PAYMENT_REFERENCE_1',
            payloadJson: {
              ipnPayload: fixtures.disputeIpnPayload,
            },
          }]);
        });

    });


    it('should make a request to payment url and return a rejected promise if gateway responds with a non 200', () => {

      const request = nock('https://base.url.com')
        .get('/payments/payment/PAY-8KR674868H750523LLJL2RUQ')
        .reply(400, {});

      return expect(paypal.parseIpnPayload(fixtures.ipnPayload, {
        type: PaymentType.creditCard,
      })).to.be.rejected.then((err) => {
        assert.equal(err.code, 'paypal_webhook_has_errors');
        assert.equal(err.status, 400);
        request.done();
      });

    });

    it('should make a request to payment url and return a rejected promise if gateway responds with a 200 but an invalid response', () => {

      const request = nock('https://base.url.com')
        .get('/payments/payment/PAY-8KR674868H750523LLJL2RUQ')
        .reply(200, {
          perritos: ['kerni'],
        });

      return expect(paypal.parseIpnPayload(fixtures.ipnPayload, {
        type: PaymentType.creditCard,
      })).to.be.rejected.then((err) => {
        assert.equal(err.code, 'bad_request');
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Invalid IPN schema');
        request.done();
      });
    });

    it('should return the clientReference from the IPN if the request response does not have it', () => {

      const correctResponse = fixtures.paymentCreationResponse.data;
      const responseWithNoClientReference = _.clone(correctResponse);
      delete responseWithNoClientReference.transactions[0].custom;

      const request = nock('https://base.url.com')
        .get('/payments/payment/PAY-8KR674868H750523LLJL2RUQ')
        .reply(200, responseWithNoClientReference);

      return expect(paypal.parseIpnPayload(fixtures.ipnPayload, {
        type: PaymentType.creditCard,
      })).to.be.fulfilled.then((resp) => {
        return assert.deepEqual(resp, [{
          client_reference: 'PAYMENT_REFERENCE_1',
          payloadJson: {
            ipnPayload: fixtures.ipnPayload,
          },
        }]);
      });
    });

  });

  describe('#ipnSuccessResponse', () => {

    it('should return a successful response with 200 status', () => {

      const endMock = sinon.spy(() => {

      });

      const statusMock = sinon.spy((statusCode) => {
        return {
          end: endMock,
        };
      });

      const responseMock = {
        status: statusMock,
      };

      paypal.ipnSuccessResponse(responseMock);

      assert(statusMock.calledWith(200));
      assert(endMock.calledOnce);

    });
  });

  describe('#capturePayment', () => {

    it('should not do anything', () => {

      // let oldPaymentMock = paymentMock.clone();
      const result = paypal.capturePayment(paymentMock);
      return expect(result).to.equal(undefined);
      // assert.deepEqual(oldPaymentMock, paymentMock);
    });
  });

  describe('#ipnFailResponse', () => {

    it('should throw the same error it receives if the message is not \'One or more ipns failed\'', () => {
      const error = new Error('Random error');

      try {
        paypal.ipnFailResponse(null, error);
      } catch (err) {
        assert.equal(err, error);
      }
    });

    it('should throw the same error it receives and add status 500 to it if the message is \'One or more ipns failed\'', () => {
      const error = new Error('One or more ipns failed');

      try {
        paypal.ipnFailResponse(null, error);
      } catch (err) {
        assert.equal(err, error);
        assert.equal(err.status, 500);
      }
    });

  });

  describe('#createPaymentData', () => {

    it('should correctly build the body from a sample payment (person)', () => {
      paypal.createPaymentData(paymentMock, fixtures.gatewayRequestMock, {})
        .then((resp) => {
          assert.deepEqual(resp, fixtures.paymentCreationOutgoingRequestPerson);
        });
    });

    it('should correctly build the body from a sample payment (company)', () => {

      const configPromise = knex('buyers')
        .where({ id: 21 })
        .update({
          type: 'company',
          name: 'Ingbee Corporation',
          birth_date: null,
          gender: null,
          document_number: '32938606000169',
          document_type: 'CNPJ',
        });

      return expect(configPromise.then(() => paypal.createPaymentData(paymentMock, fixtures.gatewayRequestMock, {})))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, fixtures.paymentCreationOutgoingRequestCompany);
        });
    });

  });

  describe('#translateIpnStatus', () => {

    let ipnDataMock;

    beforeEach(() => {
      ipnDataMock = {
        payment: fixtures.paymentCreationResponse.data,
        ipnPayload: fixtures.ipnPayload,
      };
    });

    it('should return the translated status if the translation is found and translated status is not refunded', () => {

      ipnDataMock.ipnPayload.event_type = 'PAYMENT.SALE.PENDING';
      return expect(paypal.translateIpnStatus(ipnDataMock, paymentMock))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, PaymentStatus.pendingAuthorize);
        });
    });

    it('should throw an error if the translation is not found', () => {

      const expectedError = new errors.NoMatchingStatusError('UNKNOWN.GATEWAY.STATUS.KERNI');
      ipnDataMock.ipnPayload.event_type = 'UNKNOWN.GATEWAY.STATUS.KERNI';
      return expect(paypal.translateIpnStatus(ipnDataMock, paymentMock))
        .to.be.rejected
        .then((err) => {
          assert.deepEqual(err, expectedError);
        });
    });

    let cases =
      [{
        eventType: 'PAYMENT.SALE.REFUNDED',
        paymentHistory: [
          PaymentStatus.creating,
          PaymentStatus.pendingClientAction,
          PaymentStatus.authorized,
          PaymentStatus.pendingCapture,
          PaymentStatus.successful,
        ],
        expectedStatus: PaymentStatus.refunded,
        customPaymentConditionLabel: 'payment was ever successful'
      }, {
          eventType: 'PAYMENT.SALE.REFUNDED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.pendingCancel,
          ],
          expectedStatus: PaymentStatus.cancelled,
          customPaymentConditionLabel: 'payment was ever pendingCancel'
        },
        {
          eventType: 'PAYMENT.SALE.REFUNDED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.pendingCancel,
            PaymentStatus.cancelled,
          ],
          expectedStatus: PaymentStatus.cancelled,
          customPaymentConditionLabel: 'payment was ever cancelled'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.CREATED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.authorized,
            PaymentStatus.pendingCapture,
            PaymentStatus.pendingCancel,
            PaymentStatus.cancelled,
          ],
          expectedStatus: PaymentStatus.cancelled,
          customPaymentConditionLabel: 'payment was ever cancelled'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.CREATED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.rejected,
          ],
          expectedStatus: PaymentStatus.rejected,
          customPaymentConditionLabel: 'payment was ever rejected'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.UPDATED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.rejected,
          ],
          expectedStatus: PaymentStatus.rejected,
          customPaymentConditionLabel: 'payment was ever rejected'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.UPDATED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.rejected,
          ],
          expectedStatus: PaymentStatus.rejected,
          customPaymentConditionLabel: 'payment was ever rejected'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.RESOLVED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.authorized,
            PaymentStatus.pendingCapture,
            PaymentStatus.pendingCancel,
            PaymentStatus.cancelled,
          ],
          expectedStatus: PaymentStatus.cancelled,
          customPaymentConditionLabel: 'payment was ever cancelled'
        },
        {
          eventType: 'PAYMENT.SALE.REFUNDED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.authorized,
            PaymentStatus.pendingCapture,
          ],
          expectedStatus: PaymentStatus.rejected,
          customPaymentConditionLabel: 'payment is still pending'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.RESOLVED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.rejected,
            PaymentStatus.inMediation,
            PaymentStatus.pendingCancel, //Failed cancellation attempt!
            PaymentStatus.inMediation
          ],
          expectedStatus: PaymentStatus.inMediation,
          customPaymentConditionLabel: 'payment was ever rejected'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.RESOLVED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.rejected,
            PaymentStatus.inMediation,
            PaymentStatus.pendingCancel, //Failed cancellation attempt!
            PaymentStatus.inMediation
          ],
          expectedStatus: PaymentStatus.inMediation,
          customPaymentConditionLabel: 'payment was ever rejected'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.RESOLVED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.inMediation,
            PaymentStatus.successful,
          ],
          expectedStatus: PaymentStatus.successful,
          customPaymentConditionLabel: 'payment was ever successful'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.CREATED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
            PaymentStatus.pendingAuthorize,
            PaymentStatus.pendingCancel,
            PaymentStatus.cancelled,
            PaymentStatus.inMediation,
            PaymentStatus.successful,
          ],
          expectedStatus: PaymentStatus.successful,
          customPaymentConditionLabel: 'payment was ever cancelled'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.CREATED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.pendingExecute,
          ],
          expectedStatus: PaymentStatus.pendingExecute,
          customPaymentConditionLabel: 'payment was ever cancelled'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.CREATED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.inMediation,
          ],
          expectedStatus: PaymentStatus.inMediation,
          customPaymentConditionLabel: 'payment was ever cancelled'
        },
        {
          eventType: 'CUSTOMER.DISPUTE.RESOLVED',
          paymentHistory: [
            PaymentStatus.creating,
            PaymentStatus.pendingClientAction,
            PaymentStatus.inMediation,
          ],
          expectedStatus: PaymentStatus.pendingClientAction,
          customPaymentConditionLabel: 'payment was ever cancelled'
        },


      ];

    cases.forEach((t) => {
      if (!t.customPaymentConditionLabel) {
        t.customPaymentConditionLabel = 'payment has given history';
      }
      it(`should return ${t.expectedStatus} status if the eventType was \'${t.eventType}\' and ${t.customPaymentConditionLabel}`, () => {
        ipnDataMock.ipnPayload.event_type = t.eventType;
        paymentMock.history = sinon.spy(() => Promise.resolve(t.paymentHistory));
        paymentMock.set('status_id', t.paymentHistory.slice(-1).pop());
        return expect(paypal.translateIpnStatus(ipnDataMock, paymentMock))
          .to.be.fulfilled
          .then((response) => {
            assert.deepEqual(response, t.expectedStatus);
          });
      })
    });


    it('should return \'rejected\' status if the translated status was \'refunded\' and the payment was never in the aforementioned statuses', () => {

      ipnDataMock.ipnPayload.event_type = 'PAYMENT.SALE.REFUNDED';

      paymentMock.history = sinon.spy(() => Promise.resolve([
        PaymentStatus.pendingAuthorize,
        PaymentStatus.authorized,
        PaymentStatus.pendingCapture,
      ]));

      return expect(paypal.translateIpnStatus(ipnDataMock, paymentMock))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, PaymentStatus.rejected);
        });

    });
  });

  describe('#translateAuthorizeStatus', () => {

    it('should return extract the gateway status from the correct path (if provided) and return the translated state if translation was found', () => {

      return expect(paypal.translateAuthorizeStatus(fixtures.paymentExecutionSuccessResponse, paymentMock, 'data.transactions[0].related_resources[0].sale.state'))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, PaymentStatus.successful);
        });
    });

    it('should return extract the gateway status from the default path (if NOT provided) and return the translated state if translation was found', () => {

      return expect(paypal.translateAuthorizeStatus(fixtures.paymentCreationResponse, paymentMock, null))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, PaymentStatus.pendingClientAction);
        });
    });

    it('should return extract the gateway status from the correct path (if provided) and return an error if translation was not found', () => {


      fixtures.paymentExecutionSuccessResponse.data.transactions[0].related_resources[0].sale.state = 'unknown_status';

      const expectedError = new errors.NoMatchingStatusError('unknown_status');
      return expect(paypal.translateAuthorizeStatus(fixtures.paymentExecutionSuccessResponse, paymentMock, 'data.transactions[0].related_resources[0].sale.state'))
        .to.be.rejected
        .then((err) => {
          assert.deepEqual(err, expectedError);
        });

    });

    it('should return extract the gateway status from the default path (if NOT provided) and return an error if translation was not found', () => {

      fixtures.paymentCreationResponse.data.state = 'unknown_status';

      const expectedError = new errors.NoMatchingStatusError('unknown_status');
      return expect(paypal.translateAuthorizeStatus(fixtures.paymentCreationResponse, paymentMock, null))
        .to.be.rejected
        .then((err) => {
          assert.deepEqual(err, expectedError);
        });

    });
  });

  describe('#translateAuthorizeStatusDetail', () => {

    it('should return the translated status from the correct path if response statusCode is a non 200 success code', () => {

      return expect(paypal.translateAuthorizeStatusDetail(fixtures.paymentExecutionFailureResponse, paymentMock))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, PaymentStatusDetail.no_funds);
        });
    });

    it('should return an OK status detail if the response statusCode is a 200 success code', () => {

      return expect(paypal.translateAuthorizeStatusDetail(fixtures.paymentExecutionSuccessResponse, paymentMock))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, PaymentStatusDetail.ok);
        });
    });

    it('should return an error if response statusCode is a non 200 success code but the status was not able to be translated', () => {

      fixtures.paymentExecutionFailureResponse.data.name = 'unknown_status';
      const expectedError = new errors.NoMatchingStatusError('unknown_status');
      return expect(paypal.translateAuthorizeStatusDetail(fixtures.paymentExecutionFailureResponse, paymentMock))
        .to.be.rejected
        .then((err) => {
          assert.deepEqual(err, expectedError);
        });
    });

    it('should return an error if response statusCode is a non 200 success code but the status was not found in the response body', () => {

      delete fixtures.paymentExecutionFailureResponse.data.name;
      const expectedError = new errors.NoMatchingStatusError(null);
      return expect(paypal.translateAuthorizeStatusDetail(fixtures.paymentExecutionFailureResponse, paymentMock))
        .to.be.rejected
        .then((err) => {
          assert.deepEqual(err, expectedError);
        });
    });

  });


  describe('#translateIpnStatusDetail', () => {

    let ipnDataMock;

    beforeEach(() => {
      ipnDataMock = {
        payment: fixtures.paymentCreationResponse.data,
        ipnPayload: fixtures.ipnPayload,
      };
    });

    it('it should always return a fulfilled promise with the previous payment status_detail', () => {

      return expect(paypal.translateIpnStatusDetail(ipnDataMock, paymentMock))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, PaymentStatusDetail.ok);
        });
    });

  });

  describe('#buildMetadata', () => {

    it('it should always return null', () => {
      return assert.equal(paypal.buildMetadata(fixtures.paymentCreationResponse, fixtures.gatewayRequestMock), null);
    });

  });

  describe('#extractGatewayReference', () => {
    it('should return the gateway reference of the payment creation request', () => {
      assert.equal(paypal.extractGatewayReference(fixtures.paymentCreationResponse), 'PAY-8KR674868H750523LLJL2RUQ');
    });
  });

  describe('#buildPaymentInformation', () => {

    it('should return the previous payment information if exists', () => {

      fixtures.gatewayRequestMock.paymentInformation = {
        property: 'someProperty',
      };

      const result = paypal.buildPaymentInformation(fixtures.paymentCreationResponse, fixtures.gatewayRequestMock);
      assert.deepEqual(result, {
        property: 'someProperty',
      });
    });

    it('should return an empty object if payment information is null', () => {

      fixtures.gatewayRequestMock.paymentInformation = null;

      const result = paypal.buildPaymentInformation(fixtures.paymentCreationResponse, fixtures.gatewayRequestMock);
      assert.deepEqual(result, {});
    });

    it('should return an empty object if payment information is undefined', () => {

      delete fixtures.gatewayRequestMock.paymentInformation;

      const result = paypal.buildPaymentInformation(fixtures.paymentCreationResponse, fixtures.gatewayRequestMock);
      assert.deepEqual(result, {});
    });

  });

  describe('#extractRedirectUrl', () => {

    beforeEach(() => {
      fixtures.paymentCreationResponse.body = fixtures.paymentCreationResponse.data;
    });

    it('should return the approval_url if the payment type is paypal (wallet)', () => {

      paymentMock.set('type', PaymentType.paypal);

      return expect(paypal.extractRedirectUrl(fixtures.paymentCreationResponse, fixtures.gatewayRequestMock, paymentMock))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, 'https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=EC-20960530C71342243');
        });
    });

    it('should return the correct error if approval_url is not found on the response', () => {


      const malformedCreationResponse = _.cloneDeep(fixtures.paymentCreationResponse);
      delete malformedCreationResponse.data.links;

      paymentMock.set('type', PaymentType.creditCard);

      return expect(paypal.extractRedirectUrl(malformedCreationResponse, fixtures.gatewayRequestMock, paymentMock))
        .to.be.rejected
        .then((err) => {
          assert.deepEqual(err, new Error('Could not find the approval use in the gateway response.'));
        });
    });

    it('should correctly build the redirect_url if the payment type is creditCard', () => {

      paymentMock.set('type', PaymentType.creditCard);

      return expect(paypal.extractRedirectUrl(fixtures.paymentCreationResponse, fixtures.gatewayRequestMock, paymentMock))
        .to.be.fulfilled
        .then((redirectUrlString) => {
          const redirectUrlQueries = url.parse(redirectUrlString).query;
          const redirectUrlObject = querystring.parse(redirectUrlQueries);

          assert.equal(redirectUrlObject.approvalUrl, 'https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=EC-20960530C71342243');
          assert.equal(redirectUrlObject.payerFirstName, 'Megan Powell');
          assert.equal(redirectUrlObject.payerLastName, '');
          assert.equal(redirectUrlObject.payerEmail, 'test_user_29505388@testuser.com');
          assert.equal(redirectUrlObject.payerPhone, '1234567890');
          assert.equal(redirectUrlObject.payerTaxId, '57842217000166');
          assert.equal(redirectUrlObject.payerTaxIdType, 'BR_CNPJ');
          assert.equal(redirectUrlObject.country, 'BR');
          assert.equal(redirectUrlObject.language, 'pt_BR');
          assert.equal(redirectUrlObject.paymentId, 'PAY-8KR674868H750523LLJL2RUQ');
          assert.equal(redirectUrlObject.environment, 'test');
          assert.equal(redirectUrlObject.installments, '8');
          assert.equal(redirectUrlObject.purchaseReference, 'PURCHASE_REFERENCE');
          assert.equal(redirectUrlObject.clientReference, '0123-payment-ref');
          assert.equal(redirectUrlObject.tenant, 'test-tenant');
          assert.equal(redirectUrlObject.itemName, 'Samsung Galaxy Mega Duos Preto (Bom)');
          assert.equal(redirectUrlObject.total, '400.52');
          assert.equal(redirectUrlObject.itemImageUrl, 'www.trocafone.com/image');
        });
    });


  });


});
