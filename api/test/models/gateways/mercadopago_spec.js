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

describe('#Gateways :: MercadoPago', () => {
  let mercadopago,
    requestMock,
    options,
    paymentMock,
    expectedResponseCreditCard,
    companyExpectedResponseCreditCard,
    expectedResponseTicket,
    companyExpectedResponseTicket,
    paymentGetter;

  before(() => {
    knex = require('../../../src/bookshelf').knex;
    Gateway = require('../../../src/models/gateway');
  });

  beforeEach(() => {
    return knex('gateways').insert({
      id: 1,
      tenant_id: 1,
      type: 'MERCADOPAGO',
      name: 'Mercadopago',
      base_url: 'https://base.url.com',
      created_at: new Date(),
      updated_at: new Date(),
    }).then(() => {
      return Gateway.forge({ id: 1 }).fetch();
    }).then((gateway) => {
      mercadopago = gateway;

      const modelGet = mercadopago.get;
      sinon.stub(mercadopago, 'get', function (key) {
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
      type: 'creditCard',
      gatewayMethod: 'GM_ONE',
      paymentInformation: {
        processor: 'visa',
        lastFourDigits: 1234,
        firstSixDigits: 123456,
      },
      currency: 'BRL',
      client_reference: 'CLIENT_REFERENCE',

      encryptedCreditCards: [{
        encryptedContent: 'd2fb0c50de54f2b10b9d485ffd92809a',
        encryptionType: 'mercadopagoToken',
      }],
    };

    options = {
      notificationUrl: 'https://www.test.com/tentant/v1/gateways/mercadopago/ipn',
    };

    expectedResponseCreditCard = require('../../fixtures/outgoing_requests/mercadopago_payment_credit_card_creation.json');
    companyExpectedResponseCreditCard = require('../../fixtures/outgoing_requests/mercadopago_payment_credit_card_creation_for_companies.json');

    expectedResponseTicket = require('../../fixtures/outgoing_requests/mercadopago_payment_ticket_creation.json');
    companyExpectedResponseTicket = require('../../fixtures/outgoing_requests/mercadopago_payment_ticket_creation_for_companies.json');


    return helpers.createPaymentMock()
      .then((payment) => {
        paymentMock = payment;
      });
  });

  describe('#createPaymentData', () => {
    it('should return a correct Mercadopago payment request object when buyer type is person and type is creditCard', () => {
      return expect(mercadopago.createPaymentData(paymentMock, requestMock, options))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, expectedResponseCreditCard);
        });
    });

    it('should return a correct Mercadopago payment request object when buyer type is company and type is creditCard', () => {
      const configPromise = knex('buyers')
        .where({ id: 21 })
        .update({
          type: 'company',
          name: 'SO FESTA SUPERMERCADO LTDA',
          birth_date: null,
          gender: null,
          document_number: '32938606000169',
          document_type: 'CNPJ',
        });

      return expect(configPromise.then(() => mercadopago.createPaymentData(paymentMock, requestMock, options)))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, companyExpectedResponseCreditCard);
        });
    });

    it('should return a correct Mercadopago payment request object when buyer type is person and type is ticket', () => {
      requestMock.type = 'ticket';
      return expect(mercadopago.createPaymentData(paymentMock, requestMock, options))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, expectedResponseTicket);
        });
    });

    it('should return a correct Mercadopago payment request object when buyer type is company and type is ticket', () => {
      requestMock.type = 'ticket';
      const configPromise = knex('buyers')
        .where({ id: 21 })
        .update({
          type: 'company',
          name: 'SO FESTA SUPERMERCADO LTDA',
          birth_date: null,
          gender: null,
          document_number: '32938606000169',
          document_type: 'CNPJ',
        });

      return expect(configPromise.then(() => mercadopago.createPaymentData(paymentMock, requestMock, options)))
        .to.be.fulfilled
        .then((response) => {
          assert.deepEqual(response, companyExpectedResponseTicket);
        });
    });
  });

  describe('#createPayment', () => {
    it('should return the body of the response if it was a 200', () => {
      const request = nock('https://base.url.com')
        .post('/payments?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, expectedResponseCreditCard);
        })
        .reply(200, createMockCreditCardPaymentCreationResponse('in_process').data);

      return mercadopago.createPayment(paymentMock, requestMock, options)
        .then((resp) => {
          assert.equal(resp.data.status, 'in_process');
          assert.equal(resp.data.id, 'EXTERNAL_REFERENCE');
          request.done();
        });
    });

    it('should return a rejected promise if call with all the parameters and receive a 400', () => {
      const request = nock('https://base.url.com')
        .post('/payments?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, expectedResponseCreditCard);
        })
        .reply(400, {});

      return expect(mercadopago.createPayment(paymentMock, requestMock, options)).to.be.rejected
        .then(() => {
          request.done();
        });
    });

    it('should return a rejected promise if call with all the parameters and receive a 500', () => {
      const request = nock('https://base.url.com')
        .post('/payments?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, expectedResponseCreditCard);
        })
        .reply(500, {});

      return expect(mercadopago.createPayment(paymentMock, requestMock, options)).to.be.rejected
        .then(() => {
          request.done();
        });
    });
  });

  describe('#translateAuthorizeStatus', () => {
    it('should return the status successful when request has approved status', () => {
      return mercadopago.translateAuthorizeStatus(createMockCreditCardPaymentCreationResponse('approved'), paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.successful);
        });
    });

    it('should return the status pendingAuthorize when request has in_process status', () => {
      return mercadopago.translateAuthorizeStatus(createMockCreditCardPaymentCreationResponse('in_process'), paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingAuthorize);
        });

    });

    it('should return the status pendingClientAction when request has pending status', () => {
      return mercadopago.translateAuthorizeStatus(createMockCreditCardPaymentCreationResponse('pending'), paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingClientAction);
        });

    });

    it('should return the status rejected when request has Refused status', () => {
      return mercadopago.translateAuthorizeStatus(createMockCreditCardPaymentCreationResponse('rejected'), paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.rejected);
        });
    });

    it('should return a rejected promise when request has an unknown status status', () => {
      return mercadopago.translateAuthorizeStatus(createMockCreditCardPaymentCreationResponse('UNKNOWN'), paymentMock)
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
    it('should return the status successful when request has approved status', () => {
      return mercadopago.translateIpnStatus(createMockCreditCardPaymentCreationResponse('approved').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.successful);
        });
    });

    it('should return the status pendingAuthorize when request has in_process status', () => {
      return mercadopago.translateIpnStatus(createMockCreditCardPaymentCreationResponse('in_process').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingAuthorize);
        });

    });

    it('should return the status pendingClientAction when request has pending status', () => {
      return mercadopago.translateIpnStatus(createMockCreditCardPaymentCreationResponse('pending').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.pendingClientAction);
        });

    });

    it('should return the status rejected when request has cancelled status and payment has rejected status', () => {
      paymentMock.set('status_id', 'rejected');
      return mercadopago.translateIpnStatus(createMockCreditCardPaymentCreationResponse('cancelled').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.rejected);
        });
    });

    it('should return the status rejected when request has rejected status', () => {
      return mercadopago.translateIpnStatus(createMockCreditCardPaymentCreationResponse('rejected').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.rejected);
        });
    });

    it('should return the status cancelled when request has cancelled status and payment does not have rejected status', () => {
      paymentMock.set('status_id', 'pendingCancel'); // Other than rejected
      return mercadopago.translateIpnStatus(createMockCreditCardPaymentCreationResponse('cancelled').data, paymentMock)
        .then((status) => {
          assert.equal(status, PaymentStatus.cancelled);
        });
    });

    it('should return a rejected promise when request has an unknown status status', () => {
      return mercadopago.translateIpnStatus(createMockCreditCardPaymentCreationResponse('UNKNOWN').data, paymentMock)
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
      const resp = createMockCreditCardPaymentCreationResponse('A_STATUS');
      assert.equal(mercadopago.extractGatewayReference(resp), 'EXTERNAL_REFERENCE');
    });
  });

  describe('#buildMetadata', () => {
    it('should return the correct metadata por a credit card payment', () => {
      const response = createMockCreditCardPaymentCreationResponse('A_STATUS');
      assert.deepEqual(mercadopago.buildMetadata(response), {
        collectorId: 100000000,
        issuerId: '10',
        authorizationCode: 1234,
        verification_code: null,
      });
    });
    it('should return the correct metadata por a ticket payment', () => {
      const response = createMockTicketPaymentCreationResponse('A_STATUS');
      assert.deepEqual(mercadopago.buildMetadata(response), {
        collectorId: 185370551,
        issuerId: null,
        authorizationCode: null,
        verification_code: '2508054392',
      });
    });
  });

  describe('#capturePayment', () => {
    beforeEach(() => {
      return helpers.createPaymentMock({ mercadoPagoId: 'mpMockId' })
        .then((payment) => {
          paymentMock = payment;
        });
    });

    it('should return a resolved promise if call with all the parameters and receive a confirmation  if response status is 200', () => {
      const request = nock('https://base.url.com')
        .put('/payments/mpMockId?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, {
            capture: true,
          });
        })
        .reply(200, {
          id: 123,
          status: 'authorized',
          more: 'keys',
        });

      return mercadopago.capturePayment(paymentMock)
        .then((resp) => {
          request.done();
          return resp;
        })
        .then((resp) => {
          assert.deepEqual(resp, {});
        });

    });

    it('should return a resolved promise if call with all the parameters and receive a confirmation if response status is 201', () => {
      const request = nock('https://base.url.com')
        .put('/payments/mpMockId?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, {
            capture: true,
          });
        })
        .reply(201, {
          id: 456,
          status: 'authorized',
          more: 'keys',
        });

      return mercadopago.capturePayment(paymentMock)
        .then((resp) => {
          request.done();
          return resp;
        })
        .then((resp) => {
          assert.deepEqual(resp, {});
        });

    });

    it('should return a rejected promise if call with all the parameters and receive a 400', () => {
      const request = nock('https://base.url.com')
        .put('/payments/mpMockId?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, {
            capture: true,
          });
        })
        .reply(400, {});

      return expect(mercadopago.capturePayment(paymentMock)).to.be.rejected
        .then(() => {
          request.done();
        });
    });

  });

  describe('#cancelPayment', () => {
    beforeEach(() => {
      return helpers.createPaymentMock({ mercadoPagoId: 'mpMockId' })
        .then((payment) => {
          paymentMock = payment;
        });
    });

    it('should return a resolved promise if call with all the parameters and receive a confirmation  if response status is 200', () => {
      const request = nock('https://base.url.com')
        .put('/payments/mpMockId?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, {
            status: 'cancelled',
          });
        })
        .reply(200, {
          id: 123,
          status: 'cancelled',
          more: 'keys',
        });

      return mercadopago.cancelPayment(paymentMock)
        .then((resp) => {
          request.done();
          return resp;
        })
        .then((resp) => {
          assert.deepEqual(resp, {
            pending: false,
            cancelRequestReference: 123,
          });
        });

    });

    it('should return a resolved promise if call with all the parameters and receive a confirmation if response status is 201', () => {
      const request = nock('https://base.url.com')
        .put('/payments/mpMockId?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, {
            status: 'cancelled',
          });
        })
        .reply(201, {
          id: 456,
          status: 'cancelled',
          more: 'keys',
        });

      return mercadopago.cancelPayment(paymentMock)
        .then((resp) => {
          request.done();
          return resp;
        })
        .then((resp) => {
          assert.deepEqual(resp, {
            pending: false,
            cancelRequestReference: 456,
          });
        });

    });

    it('should return a rejected promise if call with all the parameters and receive a 400', () => {
      const request = nock('https://base.url.com')
        .put('/payments/mpMockId?access_token=accessTokenMock', (body) => {
          return _.isEqual(body, {
            status: 'cancelled',
          });
        })
        .reply(400, {});

      return expect(mercadopago.cancelPayment(paymentMock)).to.be.rejected
        .then(() => {
          request.done();
        });
    });

  });

  describe('#refundPayment', () => {
    beforeEach(() => {
      return helpers.createPaymentMock({ mercadoPagoId: 'mpMockId' })
        .then((payment) => {
          paymentMock = payment;
        });
    });

    it('should refund a successful payment when it respond 200', (done) => {
      nock('https://base.url.com')
        .post('/payments/mpMockId/refunds?access_token=accessTokenMock')
        .reply(200, {
          id: 321,
          payment_id: 101010,
          amount: 73.48,
          metadata: {},
          source: {
            id: 'USER_ID',
            name: 'Firstname Lastname',
            type: 'collector',
          },
          date_created: '2014-12-11T11:26:40.537-04:00',
        });

      return mercadopago.refundPayment(paymentMock)
        .then((resp) => {
          assert.deepEqual(resp, {
            pending: false,
            cancelRequestReference: 321,
          });
        })
        .then(done)
        .catch(done);
    });

    it('should refund a successful payment when it respond 201', (done) => {
      nock('https://base.url.com')
        .post('/payments/mpMockId/refunds?access_token=accessTokenMock')
        .reply(201, {
          id: 654,
          payment_id: 101010,
          amount: 73.48,
          metadata: {},
          source: {
            id: 'USER_ID',
            name: 'Firstname Lastname',
            type: 'collector',
          },
          date_created: '2014-12-11T11:26:40.537-04:00',
        });

      return mercadopago.refundPayment(paymentMock)
        .then((resp) => {
          assert.deepEqual(resp, {
            pending: false,
            cancelRequestReference: 654,
          });
        })
        .then(done)
        .catch(done);
    });

    it('should reject a non-existing payment', (done) => {
      nock('https://base.url.com')
        .post('/payments/mpMockId/refunds?access_token=accessTokenMock')
        .reply(404, {});

      return mercadopago.refundPayment(paymentMock)
        .then(assert.fail)
        .catch((err) => {
          assert.equal(err.code, 'mercadopago_request_has_errors');
          assert.equal(err.status, 400);
          done();
        });
    });
  });

  describe('#ipnSuccessResponse', () => {
    it('should always respond with a 200 with empty body', () => {
      var resMock = {
        status: sinon.spy(() => resMock),
        end: sinon.spy(),
      };
      mercadopago.ipnSuccessResponse(resMock);

      assert(resMock.status.calledWith(200));
    });
  });

  describe('#ipnFailResponse', () => {
    it('should change the status code of the error to 500 if is an IPN propagating error and thow it', () => {
      const err = new Error('One or more ipns failed');
      err.status = 400;

      try {
        mercadopago.ipnFailResponse({}, err);
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
        mercadopago.ipnFailResponse({}, err);
      }, err);
    });
  });

  describe('#buildPaymentInformation', () => {

    it('should return the correct output for creditCard', () => {
      const responseMock = createMockCreditCardPaymentCreationResponse('pending');
      const result = mercadopago.buildPaymentInformation(responseMock, requestMock);
      assert.deepEqual(result, requestMock.paymentInformation);
    });

    it('should return the correct output for ticket', () => {
      const responseMock = createMockTicketPaymentCreationResponse('pending');
      requestMock.type = 'ticket';
      requestMock.paymentInformation = null;

      const result = mercadopago.buildPaymentInformation(responseMock, requestMock);
      assert.deepEqual(result, {
        barcode: {
          type: 'plain',
          width: null,
          height: null,
          content: '23798726800000900003380260250805439200633330',
        },
        ticket_reference: '2508054392',
        ticket_url: 'https://www.mercadopago.com/mlb/payments/ticket/helper?payment_id=2949396479&payment_method_reference_id=2508054392&caller_id=238320518',
      });
    });

  });


  describe('#parseIpnPayload', () => {
    const data = [
      {
        name: 'approved',
        external_reference: '75796facb852b2db664eb9ca81b21edb',
        id: 2526105278,
        status: 'approved',
        status_detail: 'accredited',
      },
      {
        name: 'cancelled',
        external_reference: '46cfc0ba39c9e49ff4236f37db52ac7b',
        id: 2526216721,
        status: 'cancelled',
        status_detail: 'expired',
      },
      {
        name: 'refunded',
        external_reference: '16e5279ad84cf0b7907294918a59f56e',
        id: 2526098356,
        status: 'refunded',
        status_detail: 'refunded',
      },

    ];

    _.forEach(data, (ipnData) => {
      it(`should parse a correct mercadopago webhook: ${ipnData.name}`, (done) => {
        const id = ipnData.id.toString();
        nock('https://base.url.com')
          .get(`/payments/${id}?access_token=accessTokenMock`)
          .reply(200, getIpn(ipnData));

        return mercadopago.parseIpnPayload(getWebhook(id))
          .then((resp) => {
            const ipn = resp[0];
            assert.isOk(ipn.client_reference);
            assert.equal(ipn.client_reference, ipnData.external_reference);
            assert.equal(ipn.payloadJson.status, ipnData.status);
            done();
          })
          .catch(done);
      });
    });

    it('should reject if it is a empty webhook', (done) => {
      const invalidWebhook = {};
      return mercadopago.parseIpnPayload(invalidWebhook)
        .then((resp) => {
          assert.fail();
          done();
        })
        .catch((err) => {
          assert.equal(err.status, 400);
          assert.equal(err.code, 'bad_request');
          done();
        });
    });

    it('should skip IPN if it is a mercadopago ipn', (done) => {
      const invalidIpn = {
        topic: 'payment',
        resource: 'www.test.url.com',
      };

      mercadopago.parseIpnPayload(invalidIpn)
        .then((resp) => {
          assert.fail();
        })
        .catch((e) => {
          assert.equal(e.name, 'SkipIpnError');
          done();
        })
        .catch(done);
    });


    it('should skip IPN if it is not a payment webhook', (done) => {
      const id = '2521209286';

      const invalidWebhook = getWebhook(id);
      invalidWebhook.type = 'invoice';

      return mercadopago.parseIpnPayload(invalidWebhook)
        .then((resp) => {
          assert.fail();
        })
        .catch((e) => {
          assert.equal(e.name, 'SkipIpnError');
          done();
        })
        .catch(done);
    });

    it('should reject if data.id is missing', (done) => {
      const id = '2521209286';

      const invalidWebhook = getWebhook(id);
      invalidWebhook.data = {};

      return mercadopago.parseIpnPayload(invalidWebhook)
        .then((resp) => {
          assert.fail();
          done();
        })
        .catch((err) => {
          assert.equal(err.status, 400);
          assert.equal(err.code, 'bad_request');
          done();
        })
        .catch(done);
    });

    it('should reject if there isn\'t a 200 response', (done) => {
      const id = '12345678';

      const response_404 = {
        message: 'Payment not found',
        error: 'not_found',
        status: 404,
        cause: [
          {
            code: 2000,
            description: 'Payment not found',
            data: null,
          },
        ],
      };

      nock('https://base.url.com')
        .get(`/payments/${id}?access_token=accessTokenMock`)
        .reply(404, response_404);

      return mercadopago.parseIpnPayload(getWebhook(id))
        .then((resp) => {
          assert.fail();
          done();
        })
        .catch((err) => {
          assert.equal(err.status, 400);
          assert.equal(err.code, 'mercadopago_webhook_has_errors');
          done();
        })
        .catch(done);
    }).timeout(5000);
  });

  describe('#translateIpnStatusDetail', () => {

    const statusDetails = {
      accredited: PaymentStatusDetail.ok,
      pending_contingency: PaymentStatusDetail.pending,
      pending_review_manual: PaymentStatusDetail.pending,
      pending_capture: PaymentStatusDetail.pending,
      cc_rejected_bad_filled_card_number: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_date: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_other: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_security_code: PaymentStatusDetail.wrong_card_data,
      cc_rejected_invalid_installments: PaymentStatusDetail.invalid_installment,
      cc_rejected_blacklist: PaymentStatusDetail.card_in_blacklist,
      cc_rejected_call_for_authorize: PaymentStatusDetail.call_for_authorize,
      cc_rejected_card_disabled: PaymentStatusDetail.card_disabled,
      cc_rejected_max_attempts: PaymentStatusDetail.max_attempts_reached,
      cc_rejected_card_error: PaymentStatusDetail.other,
      cc_rejected_other_reason: PaymentStatusDetail.other,
      cc_rejected_duplicated_payment: PaymentStatusDetail.duplicated_payment,
      cc_rejected_high_risk: PaymentStatusDetail.fraud,
      cc_rejected_insufficient_amount: PaymentStatusDetail.no_funds,
      payer_unavailable: PaymentStatusDetail.other,
      refunded: PaymentStatusDetail.refunded,
      settled: PaymentStatusDetail.charged_back,
      by_collector: PaymentStatusDetail.by_merchant,
      by_payer: PaymentStatusDetail.by_payer,
      bpp_refunded: PaymentStatusDetail.refunded,
      reimbursed: PaymentStatusDetail.charged_back,
      in_process: PaymentStatusDetail.pending,
      pending: PaymentStatusDetail.pending,
      expired: PaymentStatusDetail.expired,
      partially_refunded: PaymentStatusDetail.partial_refund,
      pending_waiting_payment: PaymentStatusDetail.pending,
      rejected_insufficient_data: PaymentStatusDetail.wrong_ticket_data,
      rejected_by_bank: PaymentStatusDetail.rejected_by_bank,
    };

    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail}`, () => {
        const webhook = {
          name: 'approved',
          external_reference: '75796facb852b2db664eb9ca81b21edb',
          id: 2526105278,
          status: 'approved',
          status_detail: detail,
        };
        return mercadopago.translateIpnStatusDetail(webhook, paymentMock)
          .then(statusDetail => assert.equal(statusDetail, translatedDetail));
      });
    });

    it('should reject if the webhook status_detail is unknown', (done) => {
      const webhook = {
        name: 'approved',
        external_reference: '75796facb852b2db664eb9ca81b21edb',
        id: 2526105278,
        status: 'approved',
        status_detail: 'UNKNOWN_STATUS_DETAIL',
      };

      return expect(mercadopago.translateIpnStatusDetail(webhook), paymentMock)
        .to.be.rejected
        .then(res => done())
        .catch(done);
    });
  });

  describe('#translateAuthorizeStatusDetail', () => {

    const statusDetails = {
      accredited: PaymentStatusDetail.ok,
      pending_contingency: PaymentStatusDetail.pending,
      pending_review_manual: PaymentStatusDetail.pending,
      pending_capture: PaymentStatusDetail.pending,
      cc_rejected_bad_filled_card_number: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_date: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_other: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_security_code: PaymentStatusDetail.wrong_card_data,
      cc_rejected_invalid_installments: PaymentStatusDetail.invalid_installment,
      cc_rejected_blacklist: PaymentStatusDetail.card_in_blacklist,
      cc_rejected_call_for_authorize: PaymentStatusDetail.call_for_authorize,
      cc_rejected_card_disabled: PaymentStatusDetail.card_disabled,
      cc_rejected_max_attempts: PaymentStatusDetail.max_attempts_reached,
      cc_rejected_card_error: PaymentStatusDetail.other,
      cc_rejected_other_reason: PaymentStatusDetail.other,
      cc_rejected_duplicated_payment: PaymentStatusDetail.duplicated_payment,
      cc_rejected_high_risk: PaymentStatusDetail.fraud,
      cc_rejected_insufficient_amount: PaymentStatusDetail.no_funds,
    };

    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail}`, (done) => {
        const webhook = {
          data: {
            name: 'approved',
            external_reference: '75796facb852b2db664eb9ca81b21edb',
            id: 2526105278,
            status: 'approved',
            status_detail: detail,
          },
        };

        return mercadopago.translateAuthorizeStatusDetail(webhook, paymentMock)
          .then((statusDetail) => {
            assert.equal(statusDetail, translatedDetail);
          })
          .then(done)
          .catch(done);
      });
    });

    it('should reject if the webhook status_detail is unknown', (done) => {
      const webhook = {
        data: {
          name: 'approved',
          external_reference: '75796facb852b2db664eb9ca81b21edb',
          id: 2526105278,
          status: 'approved',
          status_detail: 'UNKNOWN_STATUS_DETAIL',
        },
      };

      return expect(mercadopago.translateAuthorizeStatusDetail(webhook, paymentMock))
        .to.be.rejected
        .then(res => done())
        .catch(done);
    });
  });

  describe('#translateIpnStatus', () => {
    const statusDetails = {
      accredited: PaymentStatusDetail.ok,
      pending_contingency: PaymentStatusDetail.pending,
      pending_review_manual: PaymentStatusDetail.pending,
      pending_capture: PaymentStatusDetail.pending,
      cc_rejected_bad_filled_card_number: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_date: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_other: PaymentStatusDetail.wrong_card_data,
      cc_rejected_bad_filled_security_code: PaymentStatusDetail.wrong_card_data,
      cc_rejected_invalid_installments: PaymentStatusDetail.invalid_installment,
      cc_rejected_blacklist: PaymentStatusDetail.card_in_blacklist,
      cc_rejected_call_for_authorize: PaymentStatusDetail.call_for_authorize,
      cc_rejected_card_disabled: PaymentStatusDetail.card_disabled,
      cc_rejected_max_attempts: PaymentStatusDetail.max_attempts_reached,
      cc_rejected_card_error: PaymentStatusDetail.other,
      cc_rejected_other_reason: PaymentStatusDetail.other,
      cc_rejected_duplicated_payment: PaymentStatusDetail.duplicated_payment,
      cc_rejected_high_risk: PaymentStatusDetail.fraud,
      cc_rejected_insufficient_amount: PaymentStatusDetail.no_funds,
    };

    _.forEach(statusDetails, (translatedDetail, detail) => {
      it(`should correctly translate ${detail}`, () => {
        const webhook = {
          name: 'approved',
          external_reference: '75796facb852b2db664eb9ca81b21edb',
          id: 2526105278,
          status: 'approved',
          status_detail: detail,
        };
        return mercadopago.translateIpnStatusDetail(webhook, paymentMock)
          .then(statusDetail => assert.equal(statusDetail, translatedDetail));
      });
    });

  });
});


function createMockCreditCardPaymentCreationResponse(status) {
  const responseData = require('../../fixtures/paymentCreationResponse/mercadopago_cc.json');

  if (arguments.length !== 0) {
    _.set(responseData, 'data.status', status);
  }

  return responseData;
}

function createMockTicketPaymentCreationResponse(status) {
  const responseData = require('../../fixtures/paymentCreationResponse/mercadopago_ticket.json');

  if (arguments.length !== 0) {
    _.set(responseData, 'data.status', status);
  }

  return responseData;
}

function getWebhook(id) {
  return {
    data: {
      id,
    },
    date_created: '2017-01-06T15:12:05.000-04:00',
    type: 'payment',
    api_version: 'v1',
    id: 144377708,
    action: 'payment.created',
    user_id: 185370551,
    live_mode: true,
  };
}

function getIpn(data) {
  const ipn = {
    id: data.id,
    date_created: '2017-01-03T15:43:51.000-04:00',
    date_approved: '2017-01-03T15:43:53.000-04:00',
    date_last_updated: '2017-01-03T15:43:53.000-04:00',
    money_release_date: '2017-01-17T15:43:53.000-04:00',
    operation_type: 'regular_payment',
    issuer_id: '25',
    gateway_method_id: 'visa',
    payment_type_id: 'credit_card',
    status: data.status,
    status_detail: data.status_detail,
    currency_id: 'BRL',
    description: 'Samsung Galaxy Note 4 Branco (Excelente)',
    live_mode: true,
    sponsor_id: null,
    authorization_code: '1234567',
    collector_id: 185370551,
    payer: {
      type: 'guest',
      id: null,
      email: 'test_user_29505388@testuser.com',
      identification: {
        type: 'CPF',
        number: '111111111111',
      },
      phone: {
        area_code: '01',
        number: '1111-1111',
        extension: null,
      },
      first_name: 'Test',
      last_name: 'Test',
      entity_type: null,
    },
    metadata: {},
    additional_info: {
      items: [
        {
          id: null,
          title: 'Samsung Galaxy Note 4 Branco (Excelente)',
          description: 'Samsung Galaxy Note 4 Branco (Excelente)',
          picture_url: 'https://staging-cdna.trocafone.com/images/phones/ls-note4-branco-1.png',
          category_id: 'services',
          quantity: '1',
          unit_price: '1908.9',
        },
      ],
      payer: {
        phone: {
          number: '(14)7573-28306',
        },
        address: {
          zip_code: '05415030',
          street_name: 'Doutor Virg&iacute;lio de Carvalho Pinto',
          street_number: '602',
        },
        first_name: 'Colette',
        last_name: 'Sears',
      },
      shipments: {
        receiver_address: {
          zip_code: '05415030',
          street_name: 'Doutor Virg&iacute;lio de Carvalho Pinto',
          street_number: '602',
        },
      },
    },
    order: {},
    external_reference: data.external_reference,
    transaction_amount: 1908.9,
    transaction_amount_refunded: 0,
    coupon_amount: 0,
    differential_pricing_id: null,
    deduction_schema: null,
    transaction_details: {
      net_received_amount: 1813.65,
      total_paid_amount: 1908.9,
      overpaid_amount: 0,
      external_resource_url: null,
      installment_amount: 1908.9,
      financial_institution: null,
      gateway_method_reference_id: '1234567',
    },
    fee_details: [
      {
        type: 'mercadopago_fee',
        amount: 95.25,
        fee_payer: 'collector',
      },
    ],
    captured: true,
    binary_mode: false,
    call_for_authorize_id: null,
    statement_descriptor: 'MERCADOP-TROCAFONE',
    installments: 1,
    card: {
      id: null,
      first_six_digits: '423564',
      last_four_digits: '5682',
      expiration_month: 4,
      expiration_year: 2020,
      date_created: '2017-01-03T15:43:51.000-04:00',
      date_last_updated: '2017-01-03T15:43:51.000-04:00',
      cardholder: {
        name: 'APRO Colette Sears',
        identification: {
          number: '46276537519',
          type: 'CPF',
        },
      },
    },
    notification_url: 'https://staging.trocafone.com/comprar/checkout/webhook',
    refunds: [],
  };

  return JSON.stringify(ipn);
}
