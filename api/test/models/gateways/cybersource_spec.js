const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const nock = require('nock');
const helpers = require('../../helpers');
const path = require('path');
const readAllFiles = require('../../../src/services/read_all_files');
const Services = require('../../../src/models/constants/cybersource_services');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const PaymentStatus = require('../../../src/models/constants/payment_status');
const QueueService = require('../../../src/services/queue_service');
const helper = require('../../../src/lib/helpers');

let Gateway;
let knex;

const wdslMock = require('../../fixtures/soap/wdsl/say-hello-service');
const ipns = readAllFiles.execute(path.join(__dirname, '../../fixtures/ipns'), 'xml');

const fixtures = {
  requestFromTenantMock: require('../../fixtures/paymentCreationRequest/cybersource_payment_order'),
  successIpnMock: {content: ipns.cybersourceSuccessIpn},
  rejectIpnMock: {content: ipns.cybersourceRejectIpn},
  noDecisionIpnMock: {content: ipns.cybersourceNoDecisionIpn},
  noDecisionAndOriginalDecisionIpnMock: {content: ipns.cybersourceNoDecisionAndOriginalDecisionIpn},
  noReferenceIpnMock: {content: ipns.cybersourceNoReferenceIpn},
  unknownDecisionIpnMock: {content: ipns.cybersourceUnknownDecisionIpn},
};

const soapClientResults = {
  authorization: (decision, reasonCode) => {
    const result = {
      merchantReferenceCode: 'MERCHANT_REFERENCE_CODE',
      requestID: 'AUTH_REQUEST_ID',
      decision,
      reasonCode,
      requestToken: 'REQUEST_TOKEN',
      purchaseTotals: {currency: 'BRL'},
      ccAuthReply:
        {
          reasonCode,
          amount: '1000.00',
          authorizationCode: 'AUTHORIZATION_CODE',
          avsCode: '1',
          authorizedDateTime: '1000-01-01T00:00:00.000Z',
          processorResponse: '1',
          reconciliationID: 'RECONCILIATION_ID',
          processorTransactionID: 'PROCESSOR_TID',
          paymentNetworkTransactionID: 'PAYMENT_NETWORK_TID',
        },
    };
    return {result};
  },
  decisionManager: (decision, reasonCode) => {
    const result = {
      merchantReferenceCode: 'MERCHANT_REFERENCE_CODE',
      requestID: 'DECISION_MANAGER_REQUEST_ID',
      decision,
      reasonCode,
      requestToken: 'REQUEST_TOKEN',
      afsReply:
        {
          reasonCode: 100,
          afsResult: 33,
          hostSeverity: 1,
          consumerLocalTime: '00:00:00',
          afsFactorCode: 'A^G^Z',
          addressInfoCode: 'INTL-BA^INTL-SA^MM-BIN^UNV-ADDR',
          scoreModelUsed: 'default',
        },
      decisionReply: {activeProfileReply: null},
    };
    return {result};
  },
};

function getMockedCreateResponse(dmDecision, dmStatusCode, authDecision, authStatusCode) {

  const mock = {
    decisionManager: soapClientResults.decisionManager(dmDecision, dmStatusCode).result,
    authorization: null,
  };

  if (authDecision && authStatusCode) {
    mock.authorization = soapClientResults.authorization(authDecision, authStatusCode).result;
  }

  return mock;
}

let paymentMock;

describe('#Gateways :: Cybersource', () => {

  let cybersource;

  beforeEach(() => {
    knex = require('../../../src/bookshelf').knex;
    Gateway = require('../../../src/models/gateway');
    return knex('gateways').insert({
      id: 1,
      tenant_id: 1,
      type: 'CYBERSOURCE',
      name: 'Cybersource',
      base_url: 'http://base.url.com',
      created_at: new Date(),
      updated_at: new Date(),
    }).then(() => {
      return Gateway.forge({id: 1}).fetch();
    }).then((gateway) => {

      cybersource = gateway;
      const modelGet = cybersource.get;
      sinon.stub(cybersource, 'get', (...args) => {

        const key = args[0];
        if (key === 'keys') {
          return {
            merchant_id: 'trocafone_br',
            transaction_key: 'TX_KEY',
            manual_review_enabled_percentage: 0,
          };
        }

        return modelGet.apply(cybersource, args);

      });
    });
  });

  beforeEach(() => {
    return helpers.createPaymentMock({
      authRequestId: 'AUTH_REQUEST_ID',
    }).then((payment) => {
      paymentMock = payment;
    });
  });

  describe('#getClient', () => {

    it('should return a SOAP client', () => {

      // When the client gets initialized it calls the endpoint to get the wsdl. Mocking that.
      const wdslMockScope = nock('http://base.url.com:80')
        .get('/transactionProcessor/CyberSourceTransaction_1.151.wsdl')
        .reply(200, wdslMock);

      return expect(cybersource.getClient())
        .to.be.fulfilled
        .then((client) => {
          assert.deepEqual(client.wsdlUrl, 'http://base.url.com/transactionProcessor/CyberSourceTransaction_1.151.wsdl');
          assert.deepEqual(client.security, 'wsSecurity');
          return wdslMockScope.done();
        });

    });

  });

  describe('#createPaymentData', () => {

    it('should call the decision service on the mapper', () => {

      cybersource.mapper = {
        getDecisionManagerXML: () => {
          return 'dmXML';
        },
        update: () => sinon.spy(),
      };

      return cybersource.createPaymentData(paymentMock, fixtures.requestFromTenantMock, {
        requestedService: Services.decisionManager,
      })
        .then((resp) => {
          return assert.deepEqual(resp, 'dmXML');
        });
    });

    it('should call the authorization service on the mapper', () => {

      cybersource.mapper = {
        getAuthorizationXML: () => {
          return 'authorizationXML';
        },
        update: () => sinon.spy(),
      };

      return cybersource.createPaymentData(paymentMock, fixtures.requestFromTenantMock, {
        requestedService: Services.authorization,
      })
        .then((resp) => {
          return assert.deepEqual(resp, 'authorizationXML');
        });
    });

    it('should call the capture service on the mapper', () => {

      cybersource.mapper = {
        getCaptureXML: () => {
          return 'captureXML';
        },
        update: () => sinon.spy(),
      };

      return cybersource.createPaymentData(paymentMock, fixtures.requestFromTenantMock, {
        requestedService: Services.capture,
      })
        .then((resp) => {
          return assert.deepEqual(resp, 'captureXML');
        });
    });

    it('should call the credit service on the mapper', () => {

      cybersource.mapper = {
        getCreditXML: () => {
          return 'creditXML';
        },
        update: () => sinon.spy(),
      };

      return cybersource.createPaymentData(paymentMock, fixtures.requestFromTenantMock, {
        requestedService: Services.credit,
      })
        .then((resp) => {
          return assert.deepEqual(resp, 'creditXML');
        });
    });

    it('should call the void service on the mapper', () => {

      cybersource.mapper = {
        getVoidXML: () => {
          return 'voidXML';
        },
        update: () => sinon.spy(),
      };

      return cybersource.createPaymentData(paymentMock, fixtures.requestFromTenantMock, {
        requestedService: Services.void,
      })
        .then((resp) => {
          return assert.deepEqual(resp, 'voidXML');
        });
    });

    it('should call the authorization reversal service on the mapper', () => {

      cybersource.mapper = {
        getAuthorizationReversalXML: () => {
          return 'authorizationReversalXML';
        },
        update: () => sinon.spy(),
      };

      return cybersource.createPaymentData(paymentMock, fixtures.requestFromTenantMock, {
        requestedService: Services.authorizationReversal,
      })
        .then((resp) => {
          return assert.deepEqual(resp, 'authorizationReversalXML');
        });
    });

    it('should call the authorization reversal service on the mapper', () => {

      cybersource.mapper = {
        getManuallyRejectCaseXML: () => {
          return 'manuallyRejectCaseXML';
        },
        update: () => sinon.spy(),
      };

      return cybersource.createPaymentData(paymentMock, fixtures.requestFromTenantMock, {
        requestedService: Services.manuallyRejectCase,
      })
        .then((resp) => {
          return assert.deepEqual(resp, 'manuallyRejectCaseXML');
        });
    });

  });

  describe('#getDecisionManagerData', () => {
    it('should call the createPaymentData endpoint with the correct requested service', () => {

      const createPaymentDataStub = sinon.stub(cybersource, 'createPaymentData', () => {
        return Promise.resolve('createPaymentDataXML');
      });

      return cybersource.getDecisionManagerData(paymentMock, fixtures.requestFromTenantMock, {}).then((rawResult) => {
        assert.deepEqual(rawResult, 'createPaymentDataXML');
        return expect(createPaymentDataStub.firstCall.args[2]).to.have.property('requestedService', 'decisionManager');
      });

    });
  });

  describe('#getManuallyRejectCaseData', () => {
    it('should call the createPaymentData endpoint with the correct requested service', () => {

      const createPaymentDataStub = sinon.stub(cybersource, 'createPaymentData', () => {
        return Promise.resolve('createPaymentDataXML');
      });

      return cybersource.getManuallyRejectCaseData(paymentMock, fixtures.requestFromTenantMock, {}).then((rawResult) => {
        assert.deepEqual(rawResult, 'createPaymentDataXML');
        return expect(createPaymentDataStub.firstCall.args[2]).to.have.property('requestedService', 'manuallyRejectCase');
      });

    });
  });

  describe('#getAuthorizationData', () => {
    it('should call the createPaymentData endpoint with the correct requested service', () => {


      const createPaymentDataStub = sinon.stub(cybersource, 'createPaymentData', () => {
        return Promise.resolve('createPaymentDataXML');
      });

      return cybersource.getAuthorizationData(paymentMock, fixtures.requestFromTenantMock, {}).then((rawResult) => {
        assert.deepEqual(rawResult, 'createPaymentDataXML');
        return expect(createPaymentDataStub.firstCall.args[2]).to.have.property('requestedService', 'authorization');
      });


    });
  });

  describe('#getCaptureData', () => {
    it('should get the data for the capture request', () => {

      const createPaymentDataStub = sinon.stub(cybersource, 'createPaymentData', () => {
        return Promise.resolve('createPaymentDataXML');
      });

      return cybersource.getCaptureData(paymentMock, fixtures.requestFromTenantMock, {}).then((rawResult) => {
        assert.deepEqual(rawResult, 'createPaymentDataXML');
        return expect(createPaymentDataStub.firstCall.args[2]).to.have.property('requestedService', 'capture');
      });

    });

    it('raise the error if there is a mapping error', () => {

      const error = new Error('mapping_error');
      sinon.stub(cybersource, 'createPaymentData', () => {
        return Promise.reject(error);
      });

      return expect(cybersource.getCaptureData(paymentMock, fixtures.requestFromTenantMock, {}))
        .to.be.rejectedWith('mapping_error');

    });
  });

  describe('#capturePayment', () => {
    let originalSleep;

    beforeEach(() => {
      originalSleep = helper.sleep;
      helper.sleep = function(timeout) {
        return Promise.resolve();
      };
    })

    afterEach(() => {
      helper.sleep = originalSleep;
    })

    it('should call the soapClient with the message', () => {

      const mockResult = {
        result: {
          decision: 'ACCEPT',
          status: 200,
          reasonCode: 100,
        },
      };

      const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return cybersource.capturePayment(paymentMock).then((result) => {
        assert.deepEqual(result, mockResult);
        expect(mockedClient.runAction.firstCall.args[0]).to.eql('runTransaction');
        expect(cybersource.getCaptureData(paymentMock)).to.eventually.eql(mockedClient.runAction.firstCall.args[1]);
        return expect(runActionStub.calledOnce).to.eql(true);
      });

    });

    it('should call the soapClient and raise an Not accepted error if response doesn\'t have accepted', () => {

      const mockResult = {
        result: {
          decision: 'REJECTED',
          status: 400,
          reasonCode: 242
        },
      };

      const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return expect(cybersource.capturePayment(paymentMock))
        .to.be.rejectedWith('Capture was not accepted by gateway');

    });

    it('should call the soapClient and raise the error in case of an error', () => {

      const error = new Error('Soap Error');

      const runActionStub = sinon.stub().throws(error);

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return expect(cybersource.capturePayment(paymentMock)).to.be.rejectedWith('Soap Error');

    });
  });

  describe('#authorizePayment', () => {

    it('should call the soapClient with the message', () => {

      const mockResult = {
        result: {
          status: 200,
        },
      };

      const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return cybersource.authorizePayment(paymentMock, fixtures.requestFromTenantMock, {}).then((result) => {
        assert.deepEqual(result, mockResult);
        expect(mockedClient.runAction.firstCall.args[0]).to.eql('runTransaction');
        expect(cybersource.getAuthorizationData(paymentMock, fixtures.requestFromTenantMock, {}))
          .to.eventually.eql(mockedClient.runAction.firstCall.args[1]);
        return expect(runActionStub.calledOnce).to.eql(true);
      });

    });

    it('should return the mocked authorize if has this config set', () => {

      const mockResult = {
        result: {
          status: 200,
        },
      };

      const runActionStub = sinon.stub(cybersource, 'getMockedAuthorize').returns(Promise.resolve(mockResult));

      return cybersource.authorizePayment(paymentMock, fixtures.requestFromTenantMock, {}, true).then((result) => {
        assert.deepEqual(result, mockResult);
        return expect(runActionStub.calledOnce).to.eql(true);
      });

    });

    it('should call the soapClient and raise the error in case of an error', () => {

      const error = new Error('Soap Error');

      const runActionStub = sinon.stub().throws(error);

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return expect(cybersource.authorizePayment(paymentMock, fixtures.requestFromTenantMock, {}))
        .to.be.rejectedWith('Soap Error');

    });
  });

  describe('#decisionManagerPayment', () => {

    it('should call the soapClient with the message', () => {

      const mockResult = {
        result: {
          status: 200,
        },
      };

      const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return cybersource.decisionManagerPayment(paymentMock, fixtures.requestFromTenantMock, {}).then((result) => {
        assert.deepEqual(result, mockResult);
        expect(mockedClient.runAction.firstCall.args[0]).to.eql('runTransaction');
        expect(cybersource.getDecisionManagerData(paymentMock, fixtures.requestFromTenantMock, {}))
          .to.eventually.eql(mockedClient.runAction.firstCall.args[1]);
        return expect(runActionStub.calledOnce).to.eql(true);
      });

    });

    it('should call the soapClient and raise the error in case of an error', () => {

      const error = new Error('Soap Error');

      const runActionStub = sinon.stub().throws(error);

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return expect(cybersource.decisionManagerPayment(paymentMock, fixtures.requestFromTenantMock, {}))
        .to.be.rejectedWith('Soap Error');

    });
  });

  describe('#creditPayment', () => {
    it('should call the soapClient with the message', () => {

      const mockResult = {
        result: {
          status: 200,
          decision: 'ACCEPT',
        },
      };

      const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return cybersource.creditPayment(paymentMock, fixtures.requestFromTenantMock, {}).then((result) => {
        assert.deepEqual(result, mockResult);
        expect(mockedClient.runAction.firstCall.args[0]).to.eql('runTransaction');
        expect(cybersource.getCreditData(paymentMock, fixtures.requestFromTenantMock, {}))
          .to.eventually.eql(mockedClient.runAction.firstCall.args[1]);
        return expect(runActionStub.calledOnce).to.eql(true);
      });

    });

    it('should call the soapClient and raise the error in case of an error', () => {

      const error = new Error('Soap Error');

      const runActionStub = sinon.stub().throws(error);

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return expect(cybersource.creditPayment(paymentMock, fixtures.requestFromTenantMock, {}))
        .to.be.rejectedWith('Soap Error');

    });
  });

  describe('#manuallyRejectCase', () => {

    it('should call the soapClient with the message', () => {

      const mockResult = {
        result: {
          status: 200,
          decision: 'ACCEPT',
        },
      };

      const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return cybersource.manuallyRejectCase(paymentMock, fixtures.requestFromTenantMock, {}).then((result) => {
        assert.deepEqual(result, mockResult);
        expect(mockedClient.runAction.firstCall.args[0]).to.eql('runTransaction');
        return expect(cybersource.getManuallyRejectCaseData(paymentMock, fixtures.requestFromTenantMock, {}))
          .to.eventually.eql(mockedClient.runAction.firstCall.args[1]);
        return expect(runActionStub.calledOnce).to.eql(true);
      });

    });

    it('should call the soapClient and raise the error in case of an error', () => {

      const error = new Error('Soap Error');

      const runActionStub = sinon.stub().throws(error);

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return expect(cybersource.manuallyRejectCase(paymentMock, fixtures.requestFromTenantMock, {}))
        .to.be.rejectedWith('Soap Error');

    });
  });

  describe('#voidPayment', () => {

    it('should call the soapClient with the message', () => {

      const mockResult = {
        result: {
          status: 200,
          decision: 'ACCEPT',
        },
      };

      const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return cybersource.voidPayment(paymentMock, fixtures.requestFromTenantMock, {}).then((result) => {
        assert.deepEqual(result, mockResult);
        expect(mockedClient.runAction.firstCall.args[0]).to.eql('runTransaction');
        expect(cybersource.getVoidData(paymentMock, fixtures.requestFromTenantMock, {}))
          .to.eventually.eql(mockedClient.runAction.firstCall.args[1]);
        return expect(runActionStub.calledOnce).to.eql(true);
      });

    });

  });

  describe('#chargebackPayment', () => {
      it('should call the soapClient with to chargeback and answer accepted decision', () => {
          const mockResult = {
              result: {
                  status: 200,
                  decision: 'ACCEPT',
              },
          };
          const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));
          const mockedClient = {
              runAction: runActionStub,
          };
          sinon.stub(cybersource, 'getClient', () => {
              return Promise.resolve(mockedClient);
          });

          return cybersource.chargeBackPayment(paymentMock, {}, {}).then((result) => {
              assert.deepEqual(result, mockResult);
          });
      });

      it('should call the soapClient with to chargeback and answer accepted rejected', () => {
          const mockResult = {
              result: {
                  status: 200,
                  decision: 'REJECT',
              },
          };
          const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));
          const mockedClient = {
              runAction: runActionStub,
          };
          sinon.stub(cybersource, 'getClient', () => {
              return Promise.resolve(mockedClient);
          });

          return expect(cybersource.chargeBackPayment(paymentMock, {}, {}))
              .to.be.rejectedWith('Chargeback was not accepted by gateway');
      });

      it('should call the soapClient and raise the error in case of an error', () => {
          const error = new Error('Soap Error');
          const runActionStub = sinon.stub().throws(error);
          const mockedClient = {
              runAction: runActionStub,
          };
          sinon.stub(cybersource, 'getClient', () => {
              return Promise.resolve(mockedClient);
          });
          return expect(cybersource.chargeBackPayment(paymentMock, {}, {}))
              .to.be.rejectedWith('Soap Error');

      });
  });

  describe('#authorizationReversePayment', () => {

    it('should call the soapClient with the message', () => {

      const mockResult = {
        result: {
          status: 200,
          decision: 'ACCEPT',
        },
      };

      const runActionStub = sinon.stub().returns(Promise.resolve(mockResult));

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return cybersource.authorizationReversePayment(paymentMock, fixtures.requestFromTenantMock, {}).then((result) => {
        assert.deepEqual(result, mockResult);
        expect(mockedClient.runAction.firstCall.args[0]).to.eql('runTransaction');
        expect(cybersource.getAuthorizationReversalData(paymentMock, fixtures.requestFromTenantMock, {}))
          .to.eventually.eql(mockedClient.runAction.firstCall.args[1]);
        return expect(runActionStub.calledOnce).to.eql(true);
      });

    });

    it('should call the soapClient and raise the error in case of an error', () => {

      const error = new Error('Soap Error');

      const runActionStub = sinon.stub().throws(error);

      const mockedClient = {
        runAction: runActionStub,
      };

      sinon.stub(cybersource, 'getClient', () => {
        return Promise.resolve(mockedClient);
      });

      return expect(cybersource.voidPayment(paymentMock, fixtures.requestFromTenantMock, {}))
        .to.be.rejectedWith('Soap Error');

    });
  });

  describe('#addToCancelDecisionManagerQueue', () => {
    let queueCancelDecisionManagerCybersource;

    afterEach(() => {
        queueCancelDecisionManagerCybersource.restore();
      });

    it(('should return a promise resolved when add to queue correctly'), () => {
      queueCancelDecisionManagerCybersource = sinon.stub(QueueService, 'cancelDecisionManagerCybersource', () => {
        return Promise.resolve();
      });

      return expect(cybersource.addToCancelDecisionManagerQueue(paymentMock, 1)).to.be.fulfilled.then(() => {
        expect(queueCancelDecisionManagerCybersource.callCount).to.be.equal(1);
      });
    });

    it(('should return a promise resolved when add to queue fails'), () => {
      queueCancelDecisionManagerCybersource = sinon.stub(QueueService, 'cancelDecisionManagerCybersource', () => {
        return Promise.reject();
      });

      return expect(cybersource.addToCancelDecisionManagerQueue(paymentMock, 1)).to.be.rejected.then(() => {
        expect(queueCancelDecisionManagerCybersource.callCount).to.be.equal(1);
      });
    });
  });

  describe('#createPayment', () => {
    let allowedManualReviewMethod;
    beforeEach(() => {
      allowedManualReviewMethod = sinon.stub(cybersource, 'allowedManualReview', () => {
        return true;
      });
    })

    it(('should return the correct gateway response if both auth and dm return successful'), () => {
      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('ACCEPT', 100));
      });

      const authStub = sinon.stub(cybersource, 'authorizePayment', () => {
        return Promise.resolve(soapClientResults.authorization('ACCEPT', 100));
      });

      return cybersource.createPayment(paymentMock, {}, {}).then((response) => {
        return Promise.all([
          expect(authStub.callCount).to.eql(1),
          expect(dmStub.callCount).to.eql(1),
          expect(response).to.eql(getMockedCreateResponse('ACCEPT', 100, 'ACCEPT', 100)),
        ]);
      });
    });

    it(('should return the correct gateway response and still call auth if dm returns review'), () => {
      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('REVIEW', 408));
      });

      const authStub = sinon.stub(cybersource, 'authorizePayment', () => {
        return Promise.resolve(soapClientResults.authorization('ACCEPT', 100));
      });

      return cybersource.createPayment(paymentMock, {}, {}).then((response) => {
        return Promise.all([
          expect(authStub.callCount).to.eql(1),
          expect(dmStub.callCount).to.eql(1),
          expect(response).to.eql(getMockedCreateResponse('REVIEW', 408, 'ACCEPT', 100)),
        ]);
      });
    });

    it(('should go and cancel the review case if dm returns review and auth is rejected'), () => {
      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('REVIEW', 408));
      });

      const authStub = sinon.stub(cybersource, 'authorizePayment', () => {
        return Promise.resolve(soapClientResults.authorization('REJECT', 481));
      });


      const cancelDecisionManagerCybersourceQueue = sinon.stub(cybersource, 'addToCancelDecisionManagerQueue', () => {
        return Promise.resolve();
      });

      return cybersource.createPayment(paymentMock, {}, {}).then((response) => {
        return Promise.all([
          expect(authStub.callCount).to.eql(1),
          expect(dmStub.callCount).to.eql(1),
          expect(cancelDecisionManagerCybersourceQueue.callCount).to.eql(1),
          expect(response).to.eql(getMockedCreateResponse('REVIEW', 408, 'REJECT', 481)),
        ]);
      });
    });

    it(('should create payment even when cant to add cancelation to the queue if auth is reject and dm is in review'), () => {
      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('REVIEW', 408));
      });

      const authStub = sinon.stub(cybersource, 'authorizePayment', () => {
        return Promise.resolve(soapClientResults.authorization('REJECT', 481));
      });


      const cancelDecisionManagerCybersourceQueue = sinon.stub(cybersource, 'addToCancelDecisionManagerQueue', () => {
        return Promise.reject();
      });

      return cybersource.createPayment(paymentMock, {}, {}).then((response) => {
        return Promise.all([
          expect(authStub.callCount).to.eql(1),
          expect(dmStub.callCount).to.eql(1),
          expect(cancelDecisionManagerCybersourceQueue.callCount).to.eql(1),
          expect(response).to.eql(getMockedCreateResponse('REVIEW', 408, 'REJECT', 481)),
        ]);
      });
    });

    it(('should continue normally if the case cancelling fails for some reason '), () => {
      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('REVIEW', 408));
      });

      const authStub = sinon.stub(cybersource, 'authorizePayment', () => {
        return Promise.resolve(soapClientResults.authorization('REJECT', 481));
      });

      const cancelDecisionManagerCybersourceQueue = sinon.stub(cybersource, 'addToCancelDecisionManagerQueue', () => {
        return Promise.reject();
      });

      return cybersource.createPayment(paymentMock, {}, {}).then((response) => {
        return Promise.all([
          expect(authStub.callCount).to.eql(1),
          expect(dmStub.callCount).to.eql(1),
          expect(cancelDecisionManagerCybersourceQueue.callCount).to.eql(1),
          expect(response).to.eql(getMockedCreateResponse('REVIEW', 408, 'REJECT', 481)),
        ]);
      });
    });

    it(('should return the correct gateway response and avoid calling auth if dm returns reject'), () => {
      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('REJECT', 481));
      });

      const authSpy = sinon.spy(cybersource, 'authorizePayment');

      return cybersource.createPayment(paymentMock, {}, {}).then((response) => {
        return Promise.all([
          expect(authSpy.callCount).to.eql(0),
          expect(dmStub.callCount).to.eql(1),
          expect(response).to.eql(getMockedCreateResponse('REJECT', 481)),
        ]);
      });
    });

    it(('should return the correct gateway response and avoid calling auth if dm returns error'), () => {
      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('ERROR', 151));
      });

      const authSpy = sinon.spy(cybersource, 'authorizePayment');

      return cybersource.createPayment(paymentMock, {}, {}).then((response) => {
        return Promise.all([
          expect(authSpy.callCount).to.eql(0),
          expect(dmStub.callCount).to.eql(1),
          expect(response).to.eql(getMockedCreateResponse('ERROR', 151)),
        ]);
      });
    });

    it(('should return the throw the DM error and avoid calling authorize if DM rejects with any error'), () => {

      const dmError = new Error('Error in DM');

      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment').returns(Promise.reject(dmError));
      const authSpy = sinon.spy(cybersource, 'authorizePayment');

      return expect(cybersource.createPayment(paymentMock, {}, {})).to.be.rejectedWith('Error in DM')
        .then(() => {
          return Promise.all([
            expect(authSpy.callCount).to.eql(0),
            expect(dmStub.callCount).to.eql(1),
          ]);
        });
    });

    it(('should return the throw the Authorize error and if authorizePayment rejects with any error'), () => {

      const authError = new Error('Error in Authorization');

      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('ACCEPT', 100));
      });

      const authStub = sinon.stub(cybersource, 'authorizePayment').returns(Promise.reject(authError));

      return expect(cybersource.createPayment(paymentMock, {}, {})).to.be.rejectedWith('Error in Authorization')
        .then(() => {
          return Promise.all([
            expect(authStub.callCount).to.eql(1),
            expect(dmStub.callCount).to.eql(1),
          ]);
        });
    });

    it(('should mock authorize if dm returns review and manual_review is disabled'), () => {
      allowedManualReviewMethod.restore();
      sinon.stub(cybersource, 'allowedManualReview', () => false);

      const dmStub = sinon.stub(cybersource, 'decisionManagerPayment', () => {
        return Promise.resolve(soapClientResults.decisionManager('REVIEW', 480));
      });

      const cancelDecisionManagerCybersourceQueue = sinon.stub(cybersource, 'addToCancelDecisionManagerQueue', () => {
        return Promise.resolve();
      });

      return cybersource.createPayment(paymentMock, {}, {}).then((response) => {
        return Promise.all([
          expect(dmStub.callCount).to.eql(1),
          expect(cancelDecisionManagerCybersourceQueue.callCount).to.eql(1),
          expect(response).to.eql(getMockedCreateResponse('REVIEW', 480, 'REJECT', 999)),
        ]);
      });
    });
  });

  describe('#translateAuthorizeStatusDetail', () => {
    it(('should translate the decision manager\'s status code if it was rejected by the decision manager'), () => {
      return expect(cybersource.translateAuthorizeStatusDetail(
        getMockedCreateResponse('REJECT', 481),
        paymentMock,
      )).to.eventually.eql(PaymentStatusDetail.automatic_fraud);
    });

    it(('should translate the authorization\'s status code if it was rejected by the auth (and accepted by dm)'), () => {

      return expect(cybersource.translateAuthorizeStatusDetail(
        getMockedCreateResponse('ACCEPT', 100, 'REJECT', 481),
        paymentMock,
      )).to.eventually.eql(PaymentStatusDetail.automatic_fraud);
    });

    it(('should priorize the decision managers\'s status code if both request failed (shouldn\'t happen)'), () => {

      return expect(cybersource.translateAuthorizeStatusDetail(
        getMockedCreateResponse('REJECT', 480, 'REJECT', 481),
        paymentMock,
      )).to.eventually.eql(PaymentStatusDetail.pending);
    });

    const statusDetails = {
      100: PaymentStatusDetail.ok,
      101: PaymentStatusDetail.wrong_card_data,
      102: PaymentStatusDetail.wrong_card_data,
      150: PaymentStatusDetail.unknown,
      151: PaymentStatusDetail.timeout,
      152: PaymentStatusDetail.other,
      202: PaymentStatusDetail.expired,
      231: PaymentStatusDetail.invalid_account_number,
      233: PaymentStatusDetail.rejected_by_bank,
      234: PaymentStatusDetail.other,
      400: PaymentStatusDetail.automatic_fraud,
      480: PaymentStatusDetail.pending,
      481: PaymentStatusDetail.automatic_fraud,
      999: PaymentStatusDetail.manual_review
    };

    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail} from the decision manager`, () => {
        return expect(cybersource.translateAuthorizeStatusDetail(
          getMockedCreateResponse('REJECT', detail),
          paymentMock,
        )).to.eventually.eql(translatedDetail);
      });
    });

    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail} from the authorization`, () => {
        return expect(cybersource.translateAuthorizeStatusDetail(
          getMockedCreateResponse('ACCEPT', 100, 'REJECT', detail),
          paymentMock,
        )).to.eventually.eql(translatedDetail);
      });
    });

    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail} from the authorization if dmReview`, () => {
        return expect(cybersource.translateAuthorizeStatusDetail(
          getMockedCreateResponse('REVIEW', 100, 'REJECT', detail),
          paymentMock,
        )).to.eventually.eql(translatedDetail);
      });
    });

    it('should reject if the reasonCode is unknown', () => {
      return expect(cybersource.translateAuthorizeStatusDetail(
        getMockedCreateResponse('ACCEPT', 100, 'REJECT', 99999999),
        paymentMock,
      )).to.be.rejected;
    });

  });

  describe('#buildMetadata', () => {
    it('should correctly build the metadata if requestId is present in the request', () => {
      return expect(cybersource.buildMetadata(getMockedCreateResponse('ACCEPT', 100, 'ACCEPT', 100))).to.eql({
        authReconciliationID: 'RECONCILIATION_ID',
        authDecision: 'ACCEPT',
        authRequestId: 'AUTH_REQUEST_ID',
        authRequestToken: 'REQUEST_TOKEN',
        dmRequestId: 'DECISION_MANAGER_REQUEST_ID',
        dmRequestToken: 'REQUEST_TOKEN',
        dmDecision: 'ACCEPT',
        authAuthorizationCode: 'AUTHORIZATION_CODE',
        authProcessorTransactionID: 'PROCESSOR_TID',
        authPaymentNetworkTransactionID: 'PAYMENT_NETWORK_TID',
      });
    });

    it('should throw an error if the authorization request id is not present in the request', () => {
      const mock = getMockedCreateResponse('ACCEPT', 100, 'ACCEPT', 100);
      mock.authorization.requestID = undefined;
      return expect(() => cybersource.buildMetadata(mock)).to.throw('No requestId in the metadata');
    });
  });

  describe('#buildPaymentInformation', () => {
    it('should return the payment information the arrives on the request', () => {
      const requestMock = fixtures.requestFromTenantMock;
      const result = cybersource.buildPaymentInformation({}, requestMock);
      assert.deepEqual(result, requestMock.paymentInformation);
    });
  });

  describe('#extractGatewayReference', () => {
    it('should return the gateway reference of the payment creation request', () => {
      const resp = getMockedCreateResponse('ACCEPT', 100, 'ACCEPT', 100);
      return assert.equal(cybersource.extractGatewayReference(resp), 'MERCHANT_REFERENCE_CODE');
    });

    it('should throw the correct error if the response is malformed', () => {
      const resp = {weird_object: 'weird_object'};
      return expect(() => cybersource.extractGatewayReference(resp)).to.throw('Could not extract gateway reference');
    });
  });

  describe('#ipnSuccessResponse', () => {
    it('should always respond with a 200 with empty body', () => {
      const resMock = {
        status: sinon.spy(() => resMock),
        end: sinon.spy(),
      };
      cybersource.ipnSuccessResponse(resMock);

      assert(resMock.status.calledWith(200));
    });
  });

  describe('#ipnFailResponse', () => {
    it('should change the status code of the error to 500 if is an IPN propagating error and thow it', () => {
      const err = new Error('One or more ipns failed');
      err.status = 400;

      try {
        cybersource.ipnFailResponse({}, err);
      } catch (e) {
        assert.equal(e.message, 'One or more ipns failed');
        return assert.equal(e.status, 500);
      }

      return assert.fail(null, null, 'Should throw an exception');
    });

    it('should always throw the error given as argument', () => {
      const err = new Error('Some failure during ipn');
      return assert.throws(() => {
        cybersource.ipnFailResponse({}, err);
      }, err);
    });

  });

  describe('#extractDataFromIpn', () => {

    it('should correctly extract the decision, the original decision and the reference for a success IPN', () => {
      const ipnMock = fixtures.successIpnMock;
      return expect(cybersource.extractDataFromIpn(ipnMock)).to.eql({
        decision: 'ACCEPT',
        reference: 'CLIENT_REFERENCE',
        originalDecision: 'REVIEW',
      });
    });

    it('should correctly extract the decision and the reference for a rejected IPN', () => {
      const ipnMock = fixtures.rejectIpnMock;
      return expect(cybersource.extractDataFromIpn(ipnMock)).to.eql({
        decision: 'REJECT',
        originalDecision: 'REVIEW',
        reference: 'CLIENT_REFERENCE',
      });
    });

    it('should throw a reference not found error if no reference to the payment is included in the body', () => {
      const ipnMock = fixtures.noReferenceIpnMock;
      return expect(() => cybersource.extractDataFromIpn(ipnMock)).to.throw('Webhook does not contain payment id');
    });

    it('should throw a reference not found error if the content property of the ipn is absolutely malformed', () => {
      const ipnMock = {content: 'WAWAWAWAWAWAWAWAWAWAWAWAWAWAWA'};
      return expect(() => cybersource.extractDataFromIpn(ipnMock)).to.throw('Webhook does not contain payment id');
    });

    it('should throw a decisions not found error if no decision and original decision is not included in the body', () => {
      const ipnMock = fixtures.noDecisionAndOriginalDecisionIpnMock;
      return expect(() => cybersource.extractDataFromIpn(ipnMock)).to.throw('Could not extract decisions from notification');
    });

    it('should throw a reference not found error if there is no "Content" property in the payload', () => {
      const ipnMock = 'WAWAWAWAWAWAWAWAWAWAWAWAWAWAWA';
      return expect(() => cybersource.extractDataFromIpn(ipnMock)).to.throw('Webhook does not contain payment id');
    });

  });

  describe('#parseIpnPayload', () => {
    it('should throw a skip ipn error if the payload has no decision since it is irrelevant', () => {
      const ipnMock = fixtures.noDecisionIpnMock;
      return expect(cybersource.parseIpnPayload(ipnMock)).to.be
        .rejectedWith('The ipn is considered irrelevant and will be skipped');
    });
    it('should throw a skip ipn error if no payload is passed', () => {
      return expect(cybersource.parseIpnPayload(null)).to.be
        .rejectedWith('The ipn parsing had an error and will be skipped');
    });
    it('should throw a skip ipn error if no payload is there is a problem parsing the info in the ipn', () => {
      const ipnMock = fixtures.noDecisionAndOriginalDecisionIpnMock;
      return expect(cybersource.parseIpnPayload(ipnMock)).to.be
        .rejectedWith('The ipn parsing had an error and will be skipped');
    });
    it('should return the correct object if a good ipn is passed', () => {
      const ipnMock = fixtures.successIpnMock;
      return expect(cybersource.parseIpnPayload(ipnMock)).to.eventually.eql([{
        client_reference: 'CLIENT_REFERENCE',
        payloadJson: ipnMock,
      }]);
    });
  });
  describe('#translateIpnStatus', () => {
    it('should throw the extractDataFromIpn error if there is a problem reading the IPN', () => {
      const ipnMock = fixtures.noDecisionAndOriginalDecisionIpnMock;
      return expect(cybersource.translateIpnStatus(ipnMock, paymentMock)).to.be
        .rejectedWith('Could not extract decisions from notification');
    });
    it('should return authorized status if IPN decision was ACCEPTED', () => {
      const ipnMock = fixtures.successIpnMock;
      return expect(cybersource.translateIpnStatus(ipnMock, paymentMock))
        .to.eventually.eql(PaymentStatus.authorized);
    });
    it('should return rejected status if IPN decision was REJECTED and the payment status was not rejected', () => {
      const ipnMock = fixtures.rejectIpnMock;
      return expect(cybersource.translateIpnStatus(ipnMock, paymentMock))
        .to.eventually.eql(PaymentStatus.rejected);
    });
    it('should return rejected status if IPN decision was ACCEPTED but the payment status was rejected', () => {
      const ipnMock = fixtures.successIpnMock;
      paymentMock.set('status_id', PaymentStatus.rejected);
      return expect(cybersource.translateIpnStatus(ipnMock, paymentMock))
        .to.eventually.eql(PaymentStatus.rejected);
    });
    it('should return cancelled status if IPN decision was ACCEPTED but the payment status was cancelled', () => {
      const ipnMock = fixtures.successIpnMock;
      paymentMock.set('status_id', PaymentStatus.cancelled);
      return expect(cybersource.translateIpnStatus(ipnMock, paymentMock))
        .to.eventually.eql(PaymentStatus.cancelled);
    });
    it('should throw a NoMatchingStatusError error if the decision is not recognized', () => {
      const ipnMock = fixtures.unknownDecisionIpnMock;
      return expect(cybersource.translateIpnStatus(ipnMock, paymentMock)).to.be
        .rejectedWith('There was an error matching the provided status');
    });
  });
  describe('#translateIpnStatusDetail', () => {
    it('should throw the extractDataFromIpn error if there is a problem reading the IPN', () => {
      const ipnMock = fixtures.noDecisionAndOriginalDecisionIpnMock;
      return expect(cybersource.translateIpnStatusDetail(ipnMock), paymentMock).to.be
        .rejectedWith('Could not extract decisions from notification');
    });
    it('should return successful status if IPN decision was ACCEPTED', () => {
      const ipnMock = fixtures.successIpnMock;
      return expect(cybersource.translateIpnStatusDetail(ipnMock), paymentMock)
        .to.eventually.eql(PaymentStatusDetail.ok);
    });
    it('should return rejected status if IPN decision was REJECTED', () => {
      const ipnMock = fixtures.rejectIpnMock;
      return expect(cybersource.translateIpnStatusDetail(ipnMock), paymentMock)
        .to.eventually.eql(PaymentStatusDetail.manual_fraud);
    });
    it('should throw a NoMatchingStatusError error if the decision is not recognized', () => {
      const ipnMock = fixtures.unknownDecisionIpnMock;
      return expect(cybersource.translateIpnStatusDetail(ipnMock), paymentMock)
        .to.eventually.eql(PaymentStatusDetail.unknown);
    });
  });

})
