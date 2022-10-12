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
const helpers = require('../../helpers');

let Gateway,
  knex;

describe('#Gateways :: Totvs', () => {
  let totvs,
    requestMock,
    options,
    paymentMock;

  before(() => {
    knex = require('../../../src/bookshelf').knex;
    Gateway = require('../../../src/models/gateway');
  });

  beforeEach(() => {
    return knex('gateways').insert({
      id: 1,
      tenant_id: 1,
      type: 'TOTVS',
      name: 'Totvs',
      base_url: null,
      created_at: new Date(),
      updated_at: new Date(),
    }).then(() => {
      return Gateway.forge({ id: 1 }).fetch();
    }).then((gateway) => {
      totvs = gateway;

      const modelGet = totvs.get;
      sinon.stub(totvs, 'get', function (key) {
        if (key === 'keys') {
          return {
            accessToken: 'accessTokenMock',
            base_url: 'https://base.url.com',
            ticketPaymentMethodId: 'bolbradesco',
          };
        }

        return modelGet.apply(this, arguments);

      });
    });
  });

  beforeEach(() => {
    requestMock = {
      installments: 1,
      amountInCents: 60000,
      type: 'totvs',
      gatewayMethod: 'TOTVS',
      paymentInformation: null,
      currency: 'BRL',
      client_reference: 'CLIENT_REFERENCE',
    };

    options = {
      notificationUrl: 'https://www.test.com/tentant/v1/gateways/totvs/ipn',
    };

    const expectedResponseTotvs = require('../../fixtures/outgoing_requests/totvs.json');

    return helpers.createPaymentMock()
      .then((payment) => {
        paymentMock = payment;
      });
  });

  describe('#createPaymentData', () => {
    it('should return a correct becouse is not implemented', () => {
      return expect(totvs.createPaymentData())
        .to.be.successful;
    });
  });

  describe('#createPayment', () => {
    it('should return a correct if the body of the response', () => {
      return totvs.createPayment(paymentMock, requestMock, options)
        .then((resp) => {
          assert.equal(resp.CSTATUS, '02');
          assert.equal(resp.CSTATUSDESCR, 'unknown');
          assert.equal(resp.id, null);
        });
    });
  });

  describe('#translateAuthorizeStatus', () => {
    it('should return the status successful when request has 04 status', () => {
      return totvs.translateAuthorizeStatus(createMockTotvsPaymentCreationResponse('04').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.successful);
        });
    });

    it('should return the status pendingClientAction when request has 02 status', () => {
      return totvs.translateAuthorizeStatus(createMockTotvsPaymentCreationResponse('02').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingClientAction);
        });

    });

    it('should return the status pendingClientAction when request has 06 status', () => {
      return totvs.translateAuthorizeStatus(createMockTotvsPaymentCreationResponse('06').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.refunded);
        });

    });

    it('should return the status pendingCancel when request has 07 status', () => {
      return totvs.translateAuthorizeStatus(createMockTotvsPaymentCreationResponse('07').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingCancel);
        });
    });


    it('should return the status rejected when request has 08 status', () => {
      return totvs.translateAuthorizeStatus(createMockTotvsPaymentCreationResponse('08').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.rejected);
        });
    });


    it('should return the status cancelled when request has 10 status', () => {
      return totvs.translateAuthorizeStatus(createMockTotvsPaymentCreationResponse('10').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.cancelled);
        });
    });

    it('should return a rejected promise when request has an unknown status', () => {
      return totvs.translateAuthorizeStatus(createMockTotvsPaymentCreationResponse('UNKNOWN').data, paymentMock)
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

    it('should return the status successful when request has 04 status', () => {
      return totvs.translateIpnStatus(createMockTotvsPaymentCreationResponse('04').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.successful);
        });
    });

    it('should return the status pendingClientAction when request has 02 status', () => {
      return totvs.translateIpnStatus(createMockTotvsPaymentCreationResponse('02').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingClientAction);
        });

    });

    it('should return the status pendingClientAction when request has 06 status', () => {
      return totvs.translateIpnStatus(createMockTotvsPaymentCreationResponse('06').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.refunded);
        });

    });

    it('should return the status pendingCancel when request has 07 status', () => {
      return totvs.translateIpnStatus(createMockTotvsPaymentCreationResponse('07').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingCancel);
        });
    });


    it('should return the status rejected when request has 08 status', () => {
      return totvs.translateIpnStatus(createMockTotvsPaymentCreationResponse('08').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.rejected);
        });
    });

    it('should return the status rejected when request has 09 status', () => {
      return totvs.translateIpnStatus(createMockTotvsPaymentCreationResponse('09').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.cancelled);
        });
    });


    it('should return the status cancelled when request has 10 status', () => {
      return totvs.translateIpnStatus(createMockTotvsPaymentCreationResponse('10').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.cancelled);
        });
    });

    it('should return a rejected promise when request has an unknown status status', () => {
      return totvs.translateIpnStatus(createMockTotvsPaymentCreationResponse('UNKNOWN').data, paymentMock)
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

  describe('#extractGatewayReference', () => {
    it('should return the gateway reference of the payment creation request', () => {
      const resp = createMockTotvsPaymentCreationResponse('A_STATUS');
      assert.equal(totvs.extractGatewayReference(resp), 'A_EXTERNAL_REFERENCE');
    });
  });

  describe('#buildMetadata', () => {
    it('should return the correct metadata for a totvs payment', () => {
      const response = createMockTotvsPaymentCreationResponse('A_STATUS');
      assert.deepEqual(totvs.buildMetadata(response), {});
    });
  });

  describe('#capturePayment', () => {
    it('should return the correct capture payment for a totvs payment', () => {
      const response = createMockTotvsPaymentCreationResponse('A_STATUS');
      assert.deepEqual(totvs.buildMetadata(response), {});
    });
  });

  describe('#cancelPayment', () => {
    beforeEach(() => {
      return helpers.createPaymentMock({ totvsId: 'mpMockId' })
        .then((payment) => {
          paymentMock = payment;
        });
    });

    it('should return a rejected promise because is not implemented', () => {
      return expect(totvs.cancelPayment(paymentMock))
        .to.be.rejected;
    });
  });

  describe('#ipnSuccessResponse', () => {
    it('should always respond with a 200 with empty body', () => {
      var resMock = {
        status: sinon.spy(() => resMock),
        end: sinon.spy(),
      };
      totvs.ipnSuccessResponse(resMock);

      assert(resMock.status.calledWith(200));
    });
  });

  describe('#ipnFailResponse', () => {
    it('should change the status code of the error to 500 if is an IPN propagating error and thow it', () => {
      const err = new Error('One or more ipns failed');
      err.status = 400;

      try {
        totvs.ipnFailResponse({}, err);
      } catch (e) {
        assert.equal(e.message, 'One or more ipns failed');
        assert.equal(e.status, 500);
        return;
      }

      return assert.fail(null, null, 'Should throw an exception');
    });

    it('should always throw the error given as argument', () => {
      const err = new Error('Some failure during ipn');
      return assert.throws(() => {
        totvs.ipnFailResponse({}, err);
      }, err);
    });
  });

  describe('#buildPaymentInformation', () => {
    it('should return the correct output for totvs', () => {
      const responseMock = createMockTotvsPaymentCreationResponse('pendingClientAction');
      requestMock.type = 'totvs';
      requestMock.paymentInformation = null;

      const result = totvs.buildPaymentInformation(responseMock, requestMock);
      assert.deepEqual(result, {});
    });

  });

  describe('#parseIpnPayload', () => {
    it('should reject if it is empty IPN', (done) => {
      const invalidIpn = {};
      totvs.parseIpnPayload(invalidIpn)
        .then((resp) => {
          assert.fail();
        })
        .catch((e) => {
          assert.equal(e.name, 'HttpError');
          done();
        })
        .catch(done);
    });

    it('should reject if it does not have Payment reference', () => {
      const ipnWithoutPaymentId = {
        cErrorIDReference: 'XXX',
        cCNPJLoja: '78425986003616',
        cDocNf: '000001234',
        cSerieNf: 'UNI',
        cKeynfceNf: '35170516897144000122570000001089661001164969',
        CSTATUS: '02',
        CSTATUSDESCR: 'Pendente de pagamento',
        CSTATUSPAGTO: 'PE',
      };
      return expect(totvs.parseIpnPayload(ipnWithoutPaymentId))
        .to.be.rejectedWith('IPN does not contain payment id');
    });

    it('should return a resolve with correct IPN', () => {
      const ipn = createMockTotvsPaymentCreationResponse('A_STATUS', 'A_STATUS_DETAIL');
      return expect(totvs.parseIpnPayload(ipn))
        .to.be.successful;
    });

  });

  describe('#translateIpnStatusDetail', () => {

    const statusDetails = {
      unknown: PaymentStatusDetail.unknown,
    };

    _.forEach(statusDetails, (translatedDetail, detail) => {
      const resp = createMockTotvsPaymentCreationResponse(detail);

      it(`should correctly translate ${detail}`, () => {
        const webhook = {
          name: 'approved',
          external_reference: '75796facb852b2db664eb9ca81b21edb',
          id: 2526105278,
          status: 'approved',
          status_detail: detail,
        };
        return totvs.translateIpnStatusDetail(webhook, paymentMock)
          .then(statusDetail => assert.equal(statusDetail, translatedDetail));
      });
    });

  });

  describe('#translateAuthorizeStatusDetail', () => {
    const statusDetails = {
      unknown: PaymentStatusDetail.unknown,
      a_status_detail: PaymentStatusDetail.unknown,
    };

    const ipn = {
      IdTrcFone: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
      cCNPJLoja: '78425986003616',
      cDocNf: '000001234',
      cSerieNf: 'UNI',
      cKeynfceNf: '35170516897144000122570000001089661001164969',
      CSTATUS: '02',
      CSTATUSDESCR: 'Pendente de pagamento',
      CSTATUSPAGTO: 'PE',
    };
    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail}`, (done) => {
        return totvs.translateAuthorizeStatusDetail(ipn, paymentMock)
          .then((statusDetail) => {
            assert.equal(statusDetail, translatedDetail);
          })
          .then(done)
          .catch(done);
      });
    });
  });

  describe('#translateIpnStatus', () => {
    const statusDetails = {
      unknown: PaymentStatusDetail.unknown,
      a_status_detail: PaymentStatusDetail.unknown,
    };

    _.forEach(statusDetails, (translatedDetail, detail) => {
      const ipn = {
        name: 'approved',
        external_reference: '75796facb852b2db664eb9ca81b21edb',
        id: 2526105278,
        status: 'approved',
        status_detail: detail,
      };

      it(`should correctly translate ${detail}`, () => {
        return totvs.translateIpnStatusDetail(ipn, paymentMock)
          .then(statusDetail => assert.equal(statusDetail, translatedDetail));
      });
    });

  });
});

function createMockTotvsPaymentCreationResponse(status, status_detail) {
  const responseData = require('../../fixtures/paymentCreationResponse/totvs.json');


  if (status_detail) {
    _.set(responseData, 'data.CSTATUSDESCR', status_detail);
  }

  if (status.length !== 0) {
    _.set(responseData, 'data.CSTATUS', status);
  }

  return responseData;
}
