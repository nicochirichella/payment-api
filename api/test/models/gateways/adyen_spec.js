'use strict';

const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const nock = require('nock');
const mockery = require('mockery');
const errors = require('../../../src/errors');
const PaymentStatus = require('../../../src/models/constants/payment_status');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const PaymentOrder = require('../../../src/models/payment_order');

let Gateway,
  Payment,
  Buyer,
  Item;

describe('#Gateways :: Adyen', () => {
  let adyen,
    requestMock,
    options,
    paymentMock,
    expectedResponse,
    companyExpectedResponse,
    knex;
  const gatewayMethods = {};

  before(() => {
    mockery.enable({
      warnOnUnregistered: false,
      useCleanCache: true,
    });

    mockery.registerMock('./gateway_methods', gatewayMethods);

    knex = require('../../../src/bookshelf').knex;
    Gateway = require('../../../src/models/gateway');
    Payment = require('../../../src/models/payment');
    Buyer = require('../../../src/models/buyer');
    Item = require('../../../src/models/item');
  });

  after(() => {
    mockery.deregisterMock('./gateway_methods');
    mockery.disable();
  });

  beforeEach(() => {
    return knex('gateways').insert({
      id: 1,
      tenant_id: 1,
      type: 'ADYEN',
      name: 'Adyen',
      base_url: 'https://base.url.com',
      created_at: new Date(),
      updated_at: new Date(),
    }).then(() => {
      return Gateway.forge({ id: 1 }).fetch();
    }).then((gateway) => {
      adyen = gateway;

      const modelGet = adyen.get;
      sinon.stub(adyen, 'get', function (key) {
        if (key === 'keys') {
          return {
            basic: {
              username: 'basic-username-adyen',
              password: 'basic-password-adyen',
            },
            merchantAccount: 'merchantAccountAdyen',
          };
        }

        return modelGet.apply(this, arguments);

      });
    });
  });

  beforeEach(() => {
    requestMock = {
      installments: 4,
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
        encryptedContent: 'ENCRYPTION_ADYEN_STRING',
        encryptionType: 'adyen',
      }],
    };

    options = {
      notificationUrl: 'https://www.test.com/ipn',
    };

    paymentMock = createPaymentMock();

    expectedResponse = require('../../fixtures/outgoing_requests/adyen_payment_creation.json');
    companyExpectedResponse = require('../../fixtures/outgoing_requests/adyen_payment_creation_for_companies.json');
  });

  beforeEach(() => {
    gatewayMethods.ADYEN_CC = {
      processIpn: sinon.stub(),
    };
  });

  describe('#createPaymentData', () => {
    it('should return a correct Adyen payment request object when buyer type is person', () => {
      return expect(adyen.createPaymentData(paymentMock, requestMock, options))
        .to.be.fulfilled
        .then((data) => {
          assert.deepEqual(data, expectedResponse);
        });
    });

    it('should return a correct Adyen payment request object when buyer type is company', () => {
      const config = paymentMock.getRelation('paymentOrder')
        .then(po =>
          po.getRelation('buyer')
            .then((buyer) => {
              buyer.set('type', 'company');
              buyer.set('name', 'SO FESTA SUPERMERCADO LTDA');
              buyer.set('birth_date', null);
              buyer.set('gender', null);
            }));

      return expect(config.then(() => adyen.createPaymentData(paymentMock, requestMock, options)))
        .to.be.fulfilled
        .then((data) => {
          assert.deepEqual(data, companyExpectedResponse);
        });
    });
  });

  describe('#createPayment', () => {
    it('should return the body of the response if it was a 200', () => {
      const request = nock('https://base.url.com')
        .post('/authorise', (body) => {
          return _.isEqual(body, expectedResponse);
        })
        .reply(200, createMockPaymentCreationResponse('Authorize').data);

      return adyen.createPayment(paymentMock, requestMock, options)
        .then((resp) => {
          assert.equal(resp.data.resultCode, 'Authorize');
          assert.equal(resp.data.pspReference, 'EXTERNAL_REFERENCE');
        })
        .then((resp) => {
          request.done();
        });
    });

    it('should return a rejected promise if call with all the parameters and receive a 400', () => {
      const request = nock('https://base.url.com')
        .post('/authorise', (body) => {
          return _.isEqual(body, expectedResponse);
        })
        .reply(400, {});

      return expect(adyen.createPayment(paymentMock, requestMock, options)).to.be.rejected
        .then(() => {
          request.done();
        });
    });

    it('should return a rejected promise if call with all the parameters and receive a 500', () => {
      const request = nock('https://base.url.com')
        .post('/authorise', (body) => {
          return _.isEqual(body, expectedResponse);
        })
        .reply(500, {});

      return expect(adyen.createPayment(paymentMock, requestMock, options)).to.be.rejected
        .then(() => {
          request.done();
        });
    });
  });

  describe('#translateAuthorizeStatus', () => {
    it('should return the status successful when request has Authorised status', () => {
      return adyen.translateAuthorizeStatus(createMockPaymentCreationResponse('Authorised'), createPaymentMock())
        .then((status) => {
          assert.equal(status, PaymentStatus.authorized);
        });
    });

    it('should return the status pendingAuthorize when request has Authorised status and fraudResultType equal to AMBER', () => {
      const responsePayload = createMockPaymentCreationResponse('Authorised');
      _.set(responsePayload, 'data.additionalData.fraudResultType', 'AMBER');

      return adyen.translateAuthorizeStatus(responsePayload, createPaymentMock())
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingAuthorize);
        });

    });

    it('should return the status rejected when request has Refused status', () => {
      return adyen.translateAuthorizeStatus(createMockPaymentCreationResponse('Refused'), createPaymentMock())
        .then((status) => {
          assert.equal(status, PaymentStatus.rejected);
        });
    });

    it('should return a rejected promise when request has an unknown status status', () => {
      return adyen.translateAuthorizeStatus(createMockPaymentCreationResponse('UNKNOWN'), createPaymentMock())
        .then(() => {
          assert.fail('Should reject the promise with a NoMatchingStatusError');
        })
        .catch((e) => {
          if (e.constructor.name !== 'NoMatchingStatusError') {
            throw e;
          }
        });
    });
  });

  describe('#translateIpnStatus', () => {
    const generateIpnStatusMap = function (succeed, failed) {
      const map = {};
      if (succeed) {
        map.true = succeed;
      }
      if (failed) {
        map.false = failed;
      }
      return map;
    };

    const statusDetails = {
      AUTHORISATION: generateIpnStatusMap(PaymentStatus.authorized, PaymentStatus.rejected),
      CAPTURE: generateIpnStatusMap(PaymentStatus.successful, PaymentStatus.rejected),
      CAPTURE_FAILED: generateIpnStatusMap(PaymentStatus.rejected),
      CANCELLATION: generateIpnStatusMap(PaymentStatus.cancelled, PaymentStatus.successful),
      REFUND: generateIpnStatusMap(null, PaymentStatus.successful),
      CANCEL_OR_REFUND: generateIpnStatusMap(null, PaymentStatus.successful),
      REFUND_FAILED: generateIpnStatusMap(PaymentStatus.successful),
      REFUNDED_REVERSED: generateIpnStatusMap(null, PaymentStatus.successful),
      ORDER_OPENED: generateIpnStatusMap(PaymentStatus.pendingAuthorize),
      ORDER_CLOSED: generateIpnStatusMap(PaymentStatus.cancelled),
      PENDING: generateIpnStatusMap(PaymentStatus.pendingAuthorize),
      REQUEST_FOR_INFORMATION: generateIpnStatusMap(PaymentStatus.inMediation),
      NOTIFICATION_OF_CHARGEBACK: generateIpnStatusMap(PaymentStatus.inMediation),
      CHARGEBACK: generateIpnStatusMap(PaymentStatus.chargedBack),
      CHARGEBACK_REVERSED: generateIpnStatusMap(PaymentStatus.successful),
      MANUAL_REVIEW_ACCEPT: generateIpnStatusMap(PaymentStatus.authorized),
      MANUAL_REVIEW_REJECT: generateIpnStatusMap(PaymentStatus.rejected),
    };

    _.forEach(statusDetails, (succeedFailedMap, eventCode) => {
      _.forEach(succeedFailedMap, (translatedStatus, succeedOrFail) => {
        it(`should correctly translate ${eventCode}.${succeedOrFail} to ${translatedStatus}`, (done) => {
          const notification = {
            NotificationRequestItem: {
              amount: {
                currency: 'BRL',
                value: 72684,
              },
              eventCode,
              eventDate: '2017-02-14T19:19:43+01:00',
              merchantAccountCode: 'TrocafoneBR',
              merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
              gatewayMethod: 'visa',
              pspReference: '8824870963839018',
              reason: 'ok',
              success: succeedOrFail,
            },
          };

          return adyen.translateIpnStatus(notification, createPaymentMock())
            .then((statusDetail) => {
              assert.equal(statusDetail, translatedStatus);
            })
            .then(done)
            .catch(done);
        });
      });
    });

    it('should correctly translate REFUND.true to refunded if it was previously successful', (done) => {
      const notification = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'REFUND',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'true',
        },
      };
      const payment = createPaymentMock();

      payment.history = sinon.spy(() => resolve([
        PaymentStatus.pendingAuthorize,
        PaymentStatus.authorized,
        PaymentStatus.pendingCapture,
        PaymentStatus.successful,
      ]));

      return adyen.translateIpnStatus(notification, payment)
        .then((statusDetail) => {
          assert.equal(statusDetail, PaymentStatus.refunded);
        })
        .then(done)
        .catch(done);
    });

    it('should correctly translate CANCEL_OR_REFUND.true to refunded if it was previously successful', (done) => {
      const notification = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'REFUND',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'true',
        },
      };
      const payment = createPaymentMock();

      payment.history = sinon.spy(() => resolve([
        PaymentStatus.pendingAuthorize,
        PaymentStatus.authorized,
        PaymentStatus.pendingCapture,
        PaymentStatus.successful,
      ]));

      return adyen.translateIpnStatus(notification, payment)
        .then((statusDetail) => {
          assert.equal(statusDetail, PaymentStatus.refunded);
        })
        .then(done)
        .catch(done);
    });

    it('should correctly translate REFUND.true to rejected if it was previously in a pending status', (done) => {
      const notification = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'REFUND',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'true',
        },
      };
      const payment = createPaymentMock();

      payment.history = sinon.spy(() => resolve([
        PaymentStatus.pendingAuthorize,
        PaymentStatus.authorized,
        PaymentStatus.pendingCapture,
      ]));

      return adyen.translateIpnStatus(notification, payment)
        .then((statusDetail) => {
          assert.equal(statusDetail, PaymentStatus.rejected);
        })
        .then(done)
        .catch(done);
    });

    it('should correctly translate CANCEL_OR_REFUND.true to rejected if it was previously in a pending status', (done) => {
      const notification = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'REFUND',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'true',
        },
      };
      const payment = createPaymentMock();

      payment.history = sinon.spy(() => resolve([
        PaymentStatus.pendingAuthorize,
        PaymentStatus.authorized,
      ]));

      return adyen.translateIpnStatus(notification, payment)
        .then((statusDetail) => {
          assert.equal(statusDetail, PaymentStatus.rejected);
        })
        .then(done)
        .catch(done);
    });

    it('should correctly translate REFUND.true to cancelled if it was previously pendingCancel or cancelled', (done) => {
      const notification = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'REFUND',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'true',
        },
      };
      const payment = createPaymentMock();

      payment.history = sinon.spy(() => resolve([
        PaymentStatus.pendingAuthorize,
        PaymentStatus.authorized,
        PaymentStatus.pendingCapture,
        PaymentStatus.pendingCancel,
      ]));

      return adyen.translateIpnStatus(notification, payment)
        .then((statusDetail) => {
          assert.equal(statusDetail, PaymentStatus.cancelled);
        })
        .then(done)
        .catch(done);
    });

    it('should correctly translate CANCEL_OR_REFUND.true to cancelled if it was previously pendingCancel or cancelled', (done) => {
      const notification = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'REFUND',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'true',
        },
      };
      const payment = createPaymentMock();

      payment.history = sinon.spy(() => resolve([
        PaymentStatus.pendingAuthorize,
        PaymentStatus.authorized,
        PaymentStatus.pendingCancel,
        PaymentStatus.cancelled,
      ]));

      return adyen.translateIpnStatus(notification, payment)
        .then((statusDetail) => {
          assert.equal(statusDetail, PaymentStatus.cancelled);
        })
        .then(done)
        .catch(done);
    });

    it('should translate to pendingAuthorize when request has AUTHORISATION status and fraudResultType equal to AMBER', (done) => {
      const webhook = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          additionalData: {
            fraudResultType: 'AMBER',
          },
          eventCode: 'AUTHORISATION',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'true',
        },
      };

      return adyen.translateIpnStatus(webhook, createPaymentMock())
        .then((statusDetail) => {
          assert.equal(statusDetail, PaymentStatus.pendingAuthorize);
        })
        .then(done)
        .catch(done);
    });

    it('should reject if the notification eventCode is unknown', (done) => {
      const webhook = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'UNKNOWN_STATUS_DETAIL',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'false',
        },
      };

      return expect(adyen.translateIpnStatus(webhook, createPaymentMock()))
        .to.be.rejected
        .then(res => done())
        .catch(done);
    });

    it('should reject if no eventCode is present in the notification', (done) => {
      const webhook = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
          success: 'false',
        },
      };

      return expect(adyen.translateIpnStatus(webhook, createPaymentMock()))
        .to.be.rejectedWith('Adyen :: IPN came without eventCode or success field')
        .then(res => done())
        .catch(done);
    });

    it('should reject if no success is present in the notification', (done) => {
      const webhook = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'UNKNOWN_STATUS_DETAIL',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'ok',
        },
      };

      return expect(adyen.translateIpnStatus(webhook, createPaymentMock()))
        .to.be.rejectedWith('Adyen :: IPN came without eventCode or success field')
        .then(res => done())
        .catch(done);
    });
  });

  describe('#extractGatewayReference', () => {
    it('should return the gateway reference of the payment creation request', () => {
      const resp = createMockPaymentCreationResponse('A_STATUS');
      assert.equal(adyen.extractGatewayReference(resp), 'EXTERNAL_REFERENCE');
    });
  });

  describe('#buildMetadata', () => {
    it('should return the gateway reference of the payment creation request', () => {
      const response = createMockPaymentCreationResponse('A_STATUS');
      assert.deepEqual(adyen.buildMetadata(response), {
        pspReference: 'EXTERNAL_REFERENCE',
        authCode: 'AUTH_CODE',
        modificationPspReferences: [],
      });
    });
  });

  describe('#cancelPayment', () => {
    beforeEach(() => {
      paymentMock = createPaymentMock({
        pspReference: 'originalPspReference',
      });
    });

    it('should return a resolved promise if call with all the parameters and receive a confirmation', () => {
      const request = nock('https://base.url.com')
        .post('/cancelOrRefund', (body) => {
          return _.isEqual(body, {
            merchantAccount: 'merchantAccountAdyen',
            originalReference: 'originalPspReference',
            reference: '0123-payment-ref',
          });
        })
        .reply(200, {
          pspReference: 'cancelPspReference',
          response: '[cancelOrRefund-received]',
        });

      return adyen.cancelPayment(paymentMock)
        .then((resp) => {
          request.done();
          return resp;
        })
        .then((resp) => {
          assert.deepEqual(resp, {
            pending: true,
            cancelRequestReference: 'cancelPspReference',
          });
        });

    });

    it('should return a resolved promise if call with all the parameters and receive an error', () => {
      const request = nock('https://base.url.com')
        .post('/cancelOrRefund', (body) => {
          return _.isEqual(body, {
            merchantAccount: 'merchantAccountAdyen',
            originalReference: 'originalPspReference',
            reference: '0123-payment-ref',
          });
        })
        .reply(200, {
          pspReference: 'cancelPspReference',
          response: 'There was a problem!',
        });

      return expect(adyen.cancelPayment(paymentMock)).to.be.rejected
        .then(() => {
          request.done();
        });
    });

    it('should return a rejected promise if call with all the parameters and receive a 400', () => {
      const request = nock('https://base.url.com')
        .post('/cancelOrRefund', (body) => {
          return _.isEqual(body, {
            merchantAccount: 'merchantAccountAdyen',
            originalReference: 'originalPspReference',
            reference: '0123-payment-ref',
          });
        })
        .reply(400, {});

      return expect(adyen.cancelPayment(paymentMock)).to.be.rejected
        .then(() => {
          request.done();
        });
    });
  });

  describe('#ipnSuccessResponse', () => {

    it('should always call send with [accepted] string', () => {
      const resMock = {
        send: sinon.spy(),
      };
      adyen.ipnSuccessResponse(resMock);

      assert(resMock.send.calledWith('[accepted]'));
    });
  });

  describe('#ipnFailResponse', () => {
    let tenant,
      resMock,
      error;

    beforeEach(() => {
      tenant = {
        get: sinon.stub().withArgs('id').returns(1),
      };

      resMock = {
        send: sinon.spy(),
      };

      error = new Error('Some failure during ipn');
    });

    describe('without clientPaymentReferences', () => {
      it('should call send 200 with [accepted] string if it has no previous failed_ipns', () => {
        return adyen.ipnFailResponse(resMock, error, [], {})
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });

      it('should call send 200 with [accepted] string if it has 1 failed_ipns with the same body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: null,
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };
        return knex('failed_ipns').insert([ipn])
          .then(() => {
            return adyen.ipnFailResponse(resMock, error, [], { some: 'body' });
          })
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });

      it('should call send 200 with [accepted] string if it has 3 failed_ipns with the same body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: null,
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn, ipn, ipn])
          .then(() => {
            return adyen.ipnFailResponse(resMock, error, [], { some: 'body' });
          })
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });

      it('should call send 200 with [accepted] string if it has 5 failed_ipns with the same body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: null,
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn, ipn, ipn, ipn, ipn])
          .then(() => {
            return adyen.ipnFailResponse(resMock, error, [], { some: 'body' });
          })
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });

      it('should call send 200 with [accepted] string if it has 2 failed_ipns with other body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: null,
          message: null,
          payload: JSON.stringify({ other: 'content' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn, ipn])
          .then(() => {
            return adyen.ipnFailResponse(resMock, error, [], { some: 'body' });
          })
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });

      it('should call send 200 with [accepted] string if it has 3 failed_ipns with other body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: null,
          message: null,
          payload: JSON.stringify({ other: 'content' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn, ipn, ipn])
          .then(() => {
            return adyen.ipnFailResponse(resMock, error, [], { some: 'body' });
          })
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });

      it('should call send 200 with [accepted] string if it has 2 failed_ipns with the same body and 1 with other body', () => {
        const ipn1 = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: null,
          message: null,
          payload: JSON.stringify({ other: 'content' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        const ipn2 = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: null,
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn1, ipn2, ipn2])
          .then(() => {
            return adyen.ipnFailResponse(resMock, error, [], { some: 'body' });
          })
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });
    });

    describe('with clientPaymentReferences', () => {
      it('should raise the error without calling send if it has no previous failed_ipns', () => {
        return expect(adyen.ipnFailResponse(resMock, error, ['REFERENCE'], { some: 'body' }))
          .to.be.rejectedWith(error)
          .then(() => {
            assert.equal(resMock.send.callCount, 0, 'should not have called send method');
          });
      });

      it('should raise the error without calling send if it has 1 failed_ipns with the same body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE',
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };
        return knex('failed_ipns').insert([ipn])
          .then(() => {
            return expect(adyen.ipnFailResponse(resMock, error, ['REFERENCE'], { some: 'body' }))
              .to.be.rejectedWith(error)
              .then(() => {
                assert.equal(resMock.send.callCount, 0, 'should not have called send method');
              });
          });
      });

      it('should raise the error without calling send if it has 2 failed_ipns with other body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE',
          message: null,
          payload: JSON.stringify({ other: 'content' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn, ipn])
          .then(() => {
            return expect(adyen.ipnFailResponse(resMock, error, ['REFERENCE'], { some: 'body' }))
              .to.be.rejectedWith(error)
              .then(() => {
                assert.equal(resMock.send.callCount, 0, 'should not have called send method');
              });
          });
      });

      it('should call send 200 with [accepted] string if it has 3 failed_ipns with the same body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE',
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn, ipn, ipn])
          .then(() => {
            return adyen.ipnFailResponse(resMock, error, ['REFERENCE'], { some: 'body' });
          })
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });

      it('should call send 200 with [accepted] string if it has 5 failed_ipns with the same body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE',
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn, ipn, ipn, ipn, ipn])
          .then(() => {
            return adyen.ipnFailResponse(resMock, error, ['REFERENCE'], { some: 'body' });
          })
          .then(() => {
            assert(resMock.send.calledWith('[accepted]'));
          });
      });

      it('should raise the error without calling send if it has 3 failed_ipns with other body', () => {
        const ipn = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE',
          message: null,
          payload: JSON.stringify({ other: 'content' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn, ipn, ipn])
          .then(() => {
            return expect(adyen.ipnFailResponse(resMock, error, ['REFERENCE'], { some: 'body' }))
              .to.be.rejectedWith(error)
              .then(() => {
                assert.equal(resMock.send.callCount, 0, 'should not have called send method');
              });
          });
      });

      it('should raise the error without calling send if it has 2 failed_ipns with the same body and 1 with other body', () => {
        const ipn1 = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE',
          message: null,
          payload: JSON.stringify({ other: 'content' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        const ipn2 = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE',
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn1, ipn2, ipn2])
          .then(() => {
            return expect(adyen.ipnFailResponse(resMock, error, ['REFERENCE'], { some: 'body' }))
              .to.be.rejectedWith(error)
              .then(() => {
                assert.equal(resMock.send.callCount, 0, 'should not have called send method');
              });
          });
      });

      it('should raise the error without calling send if called with 2 payment references and we have 2 failed_ipns for one reference and 1 failed_ipns for the other', () => {
        const ipn1 = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE1',
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        const ipn2 = {
          id: 1,
          tenant_id: 1,
          gateway_id: 1,
          client_reference: 'REFERENCE2',
          message: null,
          payload: JSON.stringify({ some: 'body' }),
          created_at: new Date(),
          updated_at: new Date(),
        };

        return knex('failed_ipns').insert([ipn1, ipn2, ipn2])
          .then(() => {
            return expect(adyen.ipnFailResponse(resMock, error, ['REFERENCE1', 'REFERENCE2'], { some: 'body' }))
              .to.be.rejectedWith(error)
              .then(() => {
                assert.equal(resMock.send.callCount, 0, 'should not have called send method');
              });
          });
      });
    });
  });

  describe('#parseIpnPayload', () => {
    it('should reject if it is a malformed IPN', () => {
      return expect(adyen.parseIpnPayload({})).to.be.rejectedWith('Payload does not contain notificationItems');
    });

    it('should reject if notificationItems is not an array', () => {
      return expect(adyen.parseIpnPayload({
        notificationItems: 'true',
      })).to.be.rejectedWith('Payload does not contain notificationItems');
    });

    it('should reject if notificationItems has no items', () => {
      return expect(adyen.parseIpnPayload({
        notificationItems: [],
      })).to.be.rejectedWith('Payload does not contain notificationItems');
    });

    it('should parse an IPN with one notification', () => {
      const paymentReference = 'REFERENCE';
      const notification = {
        NotificationRequestItem: {
          merchantReference: paymentReference,
          other: 'things',
        },
      };

      return expect(adyen.parseIpnPayload({
        notificationItems: [
          notification,
        ],
      })).to.become([{
        client_reference: paymentReference,
        payloadJson: notification,
      }]);
    });

    it('should parse an IPN with multiple notification', () => {
      const paymentReference1 = 'REFERENCE1';
      const notification1 = {
        NotificationRequestItem: {
          merchantReference: paymentReference1,
          other: 'things',
        },
      };

      const paymentReference2 = 'REFERENCE2';
      const notification2 = {
        NotificationRequestItem: {
          merchantReference: paymentReference2,
          another: 'stuff',
        },
      };

      return expect(adyen.parseIpnPayload({
        notificationItems: [
          notification1,
          notification2,
        ],
      })).to.become([
        {
          client_reference: paymentReference1,
          payloadJson: notification1,
        },
        {
          client_reference: paymentReference2,
          payloadJson: notification2,
        },
      ]);
    });

    it('should reject if the notification is malformed', () => {
      const paymentReference = 'REFERENCE';
      const notification = {
        another: 'key',
      };

      return expect(adyen.parseIpnPayload({
        notificationItems: [
          notification,
        ],
      })).to.be.rejectedWith('A notification does not contain NotificationRequestItem');
    });

    it('should reject if one of the notifications is malformed', () => {
      const paymentReference1 = 'REFERENCE1';
      const notification1 = {
        NotificationRequestItem: {
          merchantReference: paymentReference1,
          other: 'things',
        },
      };

      const paymentReference2 = 'REFERENCE2';
      const notification2 = {
        wrong: 'key',
      };

      return expect(adyen.parseIpnPayload({
        notificationItems: [
          notification1,
          notification2,
        ],
      })).to.be.rejectedWith('A notification does not contain NotificationRequestItem');
    });

    it('should skip the IPN if all notifications are REPORT_AVAILABLE', () => {
      const notification1 = {
        NotificationRequestItem: {
          merchantReference: '',
          other: 'things',
          eventCode: 'REPORT_AVAILABLE',
        },
      };

      const notification2 = {
        NotificationRequestItem: {
          merchantReference: '',
          another: 'stuff',
          eventCode: 'REPORT_AVAILABLE',
        },
      };

      const ipn = {
        notificationItems: [
          notification1,
          notification2,
        ],
      };

      return expect(adyen.parseIpnPayload(ipn)).to.be.rejected
        .then(err =>
          assert.equal(err.name, 'SkipIpnError'));
    });

    it('should skip the IPN if the only notification is REPORT_AVAILABLE', () => {
      const notification = {
        NotificationRequestItem: {
          merchantReference: '',
          other: 'things',
          eventCode: 'REPORT_AVAILABLE',
        },
      };

      const ipn = {
        notificationItems: [
          notification,
        ],
      };

      return expect(adyen.parseIpnPayload(ipn)).to.be.rejected
        .then(err =>
          assert.equal(err.name, 'SkipIpnError'));
    });

    it('should only parse the notifications that are not REPORT_AVAILABLE', () => {
      const notificationReportAvailable = {
        NotificationRequestItem: {
          merchantReference: '',
          other: 'things',
          eventCode: 'REPORT_AVAILABLE',
        },
      };

      const paymentReference2 = 'REFERENCE2';
      const notification2 = {
        NotificationRequestItem: {
          merchantReference: paymentReference2,
          another: 'stuff',
        },
      };

      const ipn = {
        notificationItems: [
          notificationReportAvailable,
          notification2,
          notificationReportAvailable,
          notificationReportAvailable,
        ],
      };

      return expect(adyen.parseIpnPayload(ipn)).to.become([
        {
          client_reference: paymentReference2,
          payloadJson: notification2,
        },
      ]);
    });
  });

  describe('#translateIpnStatusDetail', () => {

    const statusDetails = {
      'Acquirer Fraud': PaymentStatusDetail.fraud,
      FRAUD: PaymentStatusDetail.fraud,
      'FRAUD-CANCELLED': PaymentStatusDetail.fraud,
      'Issuer Suspected Fraud': PaymentStatusDetail.fraud,
      'Issuer Unavailable': PaymentStatusDetail.fraud,
      'CVC Declined': PaymentStatusDetail.wrong_card_data,
      'Invalid Card Number': PaymentStatusDetail.wrong_card_data,
      'Invalid Pin': PaymentStatusDetail.wrong_card_data,
      'Declined Non Generic': PaymentStatusDetail.other,
      'Acquirer Error': PaymentStatusDetail.other,
      'Not Submitted': PaymentStatusDetail.other,
      Unknown: PaymentStatusDetail.other,
      'Invalid Amount': PaymentStatusDetail.other,
      'Blocked Card': PaymentStatusDetail.card_disabled,
      '3d-secure: Authentication failed': PaymentStatusDetail.other,
      Cancelled: PaymentStatusDetail.other,
      Refused: PaymentStatusDetail.other,
      'Expired Card': PaymentStatusDetail.card_disabled,
      'Not supported': PaymentStatusDetail.other,
      'Pin tries exceeded': PaymentStatusDetail.max_attempts_reached,
      'Pin validation not possible': PaymentStatusDetail.other,
      'Restricted Card': PaymentStatusDetail.card_disabled,
      'Revocation Of Auth': PaymentStatusDetail.other,
      'Shopper Cancelled': PaymentStatusDetail.other,
      'Withdrawal count exceeded': PaymentStatusDetail.other,
      'Transaction Not Permitted': PaymentStatusDetail.other,
      Referral: PaymentStatusDetail.other,
      'Not enough balance': PaymentStatusDetail.no_funds,
      'Withdrawal amount exceeded': PaymentStatusDetail.no_funds,
      Pending: PaymentStatusDetail.pending,
      'Card Absent Fraud': PaymentStatusDetail.charged_back,
      'No Cardholder Authorisation': PaymentStatusDetail.charged_back,
    };

    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail}`, (done) => {
        const webhook = {
          NotificationRequestItem: {
            amount: {
              currency: 'BRL',
              value: 72684,
            },
            eventCode: 'AUTHORISATION',
            eventDate: '2017-02-14T19:19:43+01:00',
            merchantAccountCode: 'TrocafoneBR',
            merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
            gatewayMethod: 'visa',
            pspReference: '8824870963839018',
            reason: detail,
            success: 'false',
          },
        };
        return adyen.translateIpnStatusDetail(webhook, createPaymentMock())
          .then((statusDetail) => {
            assert.equal(statusDetail, translatedDetail);
          })
          .then(done)
          .catch(done);
      });
    });

    it('should reject if the notification refusalReason is unknown', (done) => {
      const webhook = {
        NotificationRequestItem: {
          amount: {
            currency: 'BRL',
            value: 72684,
          },
          eventCode: 'AUTHORISATION',
          eventDate: '2017-02-14T19:19:43+01:00',
          merchantAccountCode: 'TrocafoneBR',
          merchantReference: '2716a2a82b7ed897db2da774e4f55eee',
          gatewayMethod: 'visa',
          pspReference: '8824870963839018',
          reason: 'UNKNOWN_STATUS_DETAIL',
          success: 'false',
        },
      };

      return expect(adyen.translateIpnStatusDetail(webhook, createPaymentMock()))
        .to.be.rejected
        .then(res => done())
        .catch(done);
    });
  });

  describe('#translateAuthorizeStatusDetail', () => {

    const statusDetails = {
      'Acquirer Fraud': PaymentStatusDetail.fraud,
      FRAUD: PaymentStatusDetail.fraud,
      'FRAUD-CANCELLED': PaymentStatusDetail.fraud,
      'Issuer Suspected Fraud': PaymentStatusDetail.fraud,
      'Issuer Unavailable': PaymentStatusDetail.fraud,
      'CVC Declined': PaymentStatusDetail.wrong_card_data,
      'Invalid Card Number': PaymentStatusDetail.wrong_card_data,
      'Invalid Pin': PaymentStatusDetail.wrong_card_data,
      'Declined Non Generic': PaymentStatusDetail.other,
      'Acquirer Error': PaymentStatusDetail.other,
      'Not Submitted': PaymentStatusDetail.other,
      Unknown: PaymentStatusDetail.other,
      'Invalid Amount': PaymentStatusDetail.other,
      'Blocked Card': PaymentStatusDetail.card_disabled,
      '3d-secure: Authentication failed': PaymentStatusDetail.other,
      Cancelled: PaymentStatusDetail.other,
      Refused: PaymentStatusDetail.other,
      'Expired Card': PaymentStatusDetail.card_disabled,
      'Not supported': PaymentStatusDetail.other,
      'Pin tries exceeded': PaymentStatusDetail.max_attempts_reached,
      'Pin validation not possible': PaymentStatusDetail.other,
      'Restricted Card': PaymentStatusDetail.card_disabled,
      'Revocation Of Auth': PaymentStatusDetail.other,
      'Shopper Cancelled': PaymentStatusDetail.other,
      'Withdrawal count exceeded': PaymentStatusDetail.other,
      'Transaction Not Permitted': PaymentStatusDetail.other,
      Referral: PaymentStatusDetail.other,
      'Not enough balance': PaymentStatusDetail.no_funds,
      'Withdrawal amount exceeded': PaymentStatusDetail.no_funds,
      Pending: PaymentStatusDetail.pending,
      'Card Absent Fraud': PaymentStatusDetail.charged_back,
      'No Cardholder Authorisation': PaymentStatusDetail.charged_back,
    };

    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail}`, (done) => {
        const resp = {
          data: {
            additionalData: {
              cvcResult: '1 Matches',
              authCode: '59753',
              avsResult: '4 AVS not supported for this card type',
              avsResultRaw: '4',
              paymentMethod: 'mc',
              cvcResultRaw: '1',
              refusalReasonRaw: 'AUTHORISED',
              paymentMethodVariant: 'bijcard',
              authorisationMid: '1000',
              acquirerCode: 'TestPmmAcquirer',
              acquirerReference: '7F54OQBP38Q',
              acquirerAccountCode: 'TestPmmAcquirerAccount',
            },
            pspReference: 'EXTERNAL_REFERENCE',
            resultCode: 'Refused',
            authCode: 'AUTH_CODE',
            refusalReason: detail,
          },
        };
        return adyen.translateAuthorizeStatusDetail(resp, createPaymentMock())
          .then((statusDetail) => {
            assert.equal(statusDetail, translatedDetail);
          })
          .then(done)
          .catch(done);
      });
    });

    it('should reject if the notification refusalReason is unknown', (done) => {
      const resp = {
        data: {
          additionalData: {
            cvcResult: '1 Matches',
            authCode: '59753',
            avsResult: '4 AVS not supported for this card type',
            avsResultRaw: '4',
            paymentMethod: 'mc',
            cvcResultRaw: '1',
            refusalReasonRaw: 'AUTHORISED',
            paymentMethodVariant: 'bijcard',
            authorisationMid: '1000',
            acquirerCode: 'TestPmmAcquirer',
            acquirerReference: '7F54OQBP38Q',
            acquirerAccountCode: 'TestPmmAcquirerAccount',
          },
          pspReference: 'EXTERNAL_REFERENCE',
          resultCode: 'Refused',
          authCode: 'AUTH_CODE',
          refusalReason: 'UNKNOWN',
        },
      };

      return expect(adyen.translateIpnStatusDetail(resp, createPaymentMock()))
        .to.be.rejected
        .then(res => done())
        .catch(done);
    });

    it('should reject if the notification refusalReason is not present', (done) => {
      const resp = {
        data: {
          additionalData: {
            cvcResult: '1 Matches',
            authCode: '59753',
            avsResult: '4 AVS not supported for this card type',
            avsResultRaw: '4',
            paymentMethod: 'mc',
            cvcResultRaw: '1',
            refusalReasonRaw: 'AUTHORISED',
            paymentMethodVariant: 'bijcard',
            authorisationMid: '1000',
            acquirerCode: 'TestPmmAcquirer',
            acquirerReference: '7F54OQBP38Q',
            acquirerAccountCode: 'TestPmmAcquirerAccount',
          },
          pspReference: 'EXTERNAL_REFERENCE',
          resultCode: 'Authorised',
          authCode: 'AUTH_CODE',
        },
      };

      return expect(adyen.translateIpnStatusDetail(resp, createPaymentMock()))
        .to.be.rejected
        .then(res => done())
        .catch(done);
    });
  });
});


function createMockPaymentCreationResponse(status) {
  const responseData = require('../../fixtures/paymentCreationResponse/adyen_cc_authorization.json');

  if (arguments.length !== 0) {
    _.set(responseData, 'data.resultCode', status);
  }

  return responseData;
}

function createPaymentMock(metadata) {
  const paymentOrderMock = new PaymentOrder();

  const paymentMock = new Payment();

  const buyerMock = new Buyer();

  const itemMock = new Item();

  const buyerProps = {
    external_reference: '12345',
    type: 'person',
    phone: '1234567890',
    document_number: '000111222333',
    document_type: 'CPF',
    email: 'test@test.com',
    email_type: 'EmailType',
    name: 'Fulanito Manguito Detal',
    created_at: '2016-01-01',
    updated_at: '2016-01-02',
    billing_city: 'City',
    billing_district: 'District',
    billing_country: 'Brazil',
    billing_complement: 'Complement',
    billing_number: '1234C',
    billing_zip_code: '23970000',
    billing_state_code: 'SC',
    billing_state: 'State',
    billing_street: 'Calle Loca',
    shipping_city: 'SCity',
    shipping_district: 'SDistrict',
    shipping_country: 'Brazil',
    shipping_complement: 'SComplement',
    shipping_number: 'S1234C',
    shipping_zip_code: 'S2397000',
    shipping_state_code: 'SSC',
    shipping_state: 'SState',
    shipping_street: 'SCalle Loca',
    gender: 'M',
    birth_date: '1980-12-10',
    ip_address: '100.200.100.200',
  };

  const paymentProps = {
    currency: 'CUR',
    amount: 34.20,
    type: 'creditCard',
    interest: 10.02,
    client_reference: '0123-payment-ref',
    client_order_reference: '0123-order-ref',
    id: 666,
  };

  if (metadata) {
    paymentProps.metadata = metadata;
  }

  const itemProps = {
    name: 'Samsung Galaxy Mega Duos Preto (Bom)',
    description: 'Samsung Galaxy Mega Duos Preto (Bom)',
    external_reference: '4499',
    discount: 10,
    total: 34.20,
    unit_cost: 34.20,
    quantity: 1,
  };

  paymentOrderMock.getRelation = sinon.stub();
  paymentOrderMock.getRelation.withArgs('buyer').returns(resolve(buyerMock));
  paymentOrderMock.getRelation.withArgs('items').returns(resolve([itemMock]));
  paymentMock.getRelation = sinon.stub();
  paymentMock.getRelation.withArgs('paymentOrder').returns(resolve(paymentOrderMock));

  buyerMock.set(buyerProps);
  paymentMock.set(paymentProps);
  itemMock.set(itemProps);

  return paymentMock;
}

function resolve(value) {
  return new Promise(((res, rej) => {
    process.nextTick(() => {
      res(value);
    });
  }));
}
