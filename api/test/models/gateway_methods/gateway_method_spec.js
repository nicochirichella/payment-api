'use strict';

const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const PaymentStatus = require('../../../src/models/constants/payment_status.js');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const GatewayMethod = require('../../../src/models/gateway_method');
const Gateway = require('../../../src/models/gateway.js');
const Payment = require('../../../src/models/payment.js');
const Promise = require('bluebird');
const knex = require('../../../src/bookshelf').knex;
const errors = require('../../../src/errors');
const moment = require('moment-business-time');

describe('#Gateway Method', () => {
  let gatewayMethod,
    gateway,
    payment;

  const requestData = {
    installments: 6,
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
      encryptedContent: 'CARDTOKEN',
      encryptionType: 'mercadopagoToken',
    }],
  };

  beforeEach(() => {
    gateway = Gateway.forge({ id: 1 });

    gatewayMethod = GatewayMethod.forge({
      id: 1,
      tenant_id: 1,
      payment_ttl: 2880,
    });
    gatewayMethod.gateway = gateway;

    return knex('payments').insert({
      id: 1,
      currency: 'CUR',
      installments: 6,
      amount: 34.20,
      interest: 0,
      type: 'creditCard',
      client_reference: '0123-payment-ref',
      status_id: PaymentStatus.pendingAuthorize,
      status_detail: PaymentStatusDetail.pending,
      gateway_method_id: 1,
      buyer_id: 2,
      tenant_id: 3,
      expiration_date: '2019-01-21T15:13:14.774000Z',
    }).then(() =>
      Payment.forge({ id: 1 }).fetch().then(p => payment = p));
  });

  describe('#processPayment', () => {
    it('should succeed if sendPayment is resolved and gatewayMethodActionType is status', () => {

      gatewayMethod.gatewayMethodActionType = 'status';
      gateway.sendPayment = sinon.stub().returns(mockSendPaymentStatusResponse(PaymentStatus.successful, PaymentStatusDetail.ok));
      return expect(gatewayMethod.processPayment(payment, requestData))
        .to.be.fulfilled
        .then((resp) => {
          assert(gateway.sendPayment.calledOnce);

          assert.deepEqual(resp, {
            external_reference: 'GatewayReference',
            client_reference: payment.get('client_reference'),
            gateway_method_action_type: 'status',
            redirect_url: null,
            should_retry: false,
            status_id: 'successful',
          });

          return payment.refresh().then((payment) => {
            assert.equal(payment.get('status_id'), PaymentStatus.successful);
            assert.equal(payment.get('status_detail'), PaymentStatusDetail.ok);
          });
        });
    });

    it('should succeed if sendPayment is resolved and gatewayMethodActionType is redirectUrl', () => {

      gatewayMethod.gatewayMethodActionType = 'redirect';
      gateway.sendPayment = sinon.stub().returns(mockSendPaymentRedirectResponse(PaymentStatus.successful, PaymentStatusDetail.ok));
      return expect(gatewayMethod.processPayment(payment, requestData))
        .to.be.fulfilled
        .then((resp) => {
          assert(gateway.sendPayment.calledOnce);

          assert.deepEqual(resp, {
            external_reference: 'GatewayReference',
            client_reference: payment.get('client_reference'),
            gateway_method_action_type: 'redirect',
            redirect_url: 'www.example.com',
            should_retry: false,
            status_id: 'successful',
          });

          return payment.refresh().then((payment) => {
            assert.equal(payment.get('status_id'), PaymentStatus.successful);
            assert.equal(payment.get('status_detail'), PaymentStatusDetail.ok);
          });
        });
    });

    it('should fail if sendPayment fails', () => {
      gateway.sendPayment = sinon.spy(() => reject());

      return expect(gatewayMethod.processPayment(payment, requestData))
        .to.be.rejected
        .then(() => {
          return payment.refresh().then((p) => {
            return assert.equal(p.get('status_id'), PaymentStatus.error);
          });
        });
    });

    it('should succeed is the payment isn\'t authorized or successful', () => {
      gateway.sendPayment = sinon.spy(() => resolve({
        paymentStatus: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.fraud,
      }));

      return expect(gatewayMethod.processPayment(payment, requestData))
        .to.be.fulfilled
        .then(() => {
          return payment.refresh().then((p) => {
            assert.equal(p.get('status_id'), PaymentStatus.rejected);
            assert.equal(p.get('status_detail'), PaymentStatusDetail.fraud);
          });
        });
    });
  });

  describe('#saveIpnResult', () => {
    it('should return a successful promise with a payment and the propagate set true', () => {
      return gatewayMethod.saveIpnResult(payment, {
        status: PaymentStatus.pendingAuthorize,
        statusDetail: PaymentStatusDetail.pending,
      })
        .then((resp) => {
          assert.equal(resp.payment.get('status_id'), PaymentStatus.pendingAuthorize);
          assert.equal(resp.payment.get('status_detail'), PaymentStatusDetail.pending);
          assert(resp.propagate === true, 'resp.propagate should be boolean true');
        });
    });
    it('should return a successful update the payment without changing the original data', () => {
      return Payment.forge({ id: 1 })
        .fetch()
        .then(p =>
          p.save('gateway_reference', 'NEW_GATEWAY_REFERENCE', { patch: true }))
        .then(() => {
          return gatewayMethod.saveIpnResult(payment, {
            status: PaymentStatus.pendingAuthorize,
            statusDetail: PaymentStatusDetail.pending,
          })
            .then((resp) => {
              assert.equal(resp.payment.get('status_id'), PaymentStatus.pendingAuthorize);
              assert.equal(resp.payment.get('status_detail'), PaymentStatusDetail.pending);
              assert.equal(resp.payment.get('gateway_reference'), 'NEW_GATEWAY_REFERENCE', 'resp.payment should have up-to-date data');
              assert(resp.propagate === true, 'resp.propagate should be boolean true');

              return Payment.forge({ id: 1 }).fetch()
                .then((p) => {
                  assert.equal(p.get('gateway_reference'), 'NEW_GATEWAY_REFERENCE', 'payment attributes in the database should be unchanged');
                });
            });
        });
    });

    it('should return a rejected promise if there was an issue saving the payment', () => {
      const err = new Error('Database is broken');
      payment.save = () => reject(err);
      const oldSave = Payment.prototype.save;
      Payment.prototype.save = () => reject(err);

      return expect(gatewayMethod.saveIpnResult(payment, {
        status: PaymentStatus.pendingAuthorize,
        statusDetail: PaymentStatusDetail.pending,
      }))
        .to.be.rejectedWith(err).then(() => {
          Payment.prototype.save = oldSave;
        });
    });

    it('should save the statusDetail that is given', () => {
      payment.set('status_detail', PaymentStatusDetail.ok);

      return gatewayMethod.saveIpnResult(payment, {
        status: PaymentStatus.pendingAuthorize,
        statusDetail: PaymentStatusDetail.pending,
      })
        .then((res) => {
          assert.equal(res.payment.get('status_detail'), PaymentStatusDetail.pending);
        });
    });

    it('should save the payment status that is given if it\'s different form the actual value', () => {
      payment.set('status_id', PaymentStatus.pendingAuthorize);

      return gatewayMethod.saveIpnResult(payment, {
        status: PaymentStatus.authorized,
        statusDetail: PaymentStatusDetail.ok,
      })
        .then((res) => {
          assert.equal(res.payment.get('status_id'), PaymentStatus.authorized);
        });
    });

    it('should continue to have the same payment status if the given one is equal form the actual value', () => {
      payment.set('status_id', PaymentStatus.pendingAuthorize);

      return gatewayMethod.saveIpnResult(payment, {
        status: PaymentStatus.pendingAuthorize,
        statusDetail: PaymentStatusDetail.ok,
      })
        .then((res) => {
          assert.equal(res.payment.get('status_id'), PaymentStatus.pendingAuthorize);
        });
    });

    it('should continue to have the same payment status_detail if the status given one is equal form the actual value', () => {
      payment.set('status_id', PaymentStatus.rejected);
      payment.set('status_detail', PaymentStatusDetail.automatic_fraud);

      return payment.save()
        .then(() => {
          return gatewayMethod.saveIpnResult(payment, {
            status: PaymentStatus.rejected,
            statusDetail: PaymentStatusDetail.manual_fraud,
          })
            .then((res) => {
              assert.equal(res.payment.get('status_id'), PaymentStatus.rejected);
              assert.equal(res.payment.get('status_detail'), PaymentStatusDetail.automatic_fraud);
            });
        });
    });

    it('should transition to new status even though the resulting transition from the IPN is an invalid transition', () => {
      payment.set('status_id', PaymentStatus.successful);

      return gatewayMethod.saveIpnResult(payment, {
        status: PaymentStatus.rejected,
        statusDetail: PaymentStatusDetail.card_in_blacklist,
      })
        .then((res) => {
          assert.equal(res.payment.get('status_id'), PaymentStatus.rejected);
        });
    });

    it('should reject promise with SkipIpnError if the resulting transition from the IPN is an ignorable transition', () => {
      payment.set('status_id', PaymentStatus.pendingCancel);

      return expect(gatewayMethod.saveIpnResult(payment, {
        status: PaymentStatus.pendingAuthorize,
        statusDetail: PaymentStatusDetail.pending,
      }))
        .to.be.rejectedWith(errors.SkipIpnError);
    });

  });

  describe('#getConfig', () => {
    it('should throw a not found error for a not known gateway method', () => {
      return expect(gatewayMethod.getConfig())
        .to.be.rejectedWith(errors.NotFoundError, 'Gateway config not found');
    });
  });

  describe('#validateInterest', () => {
    beforeEach(() => {
      const promise1 = knex('interest_rates').insert({
        id: 1,
        amount: 1,
        interest: -5,
        gateway_method_id: 1,
      });
      const promise2 = knex('interest_rates').insert({
        id: 2,
        amount: 2,
        interest: 0,
        gateway_method_id: 1,
      });
      const promise3 = knex('interest_rates').insert({
        id: 3,
        amount: 3,
        interest: 3,
        gateway_method_id: 1,
      });
      return Promise.all([promise1, promise2, promise3]);
    });

    describe('when the interest is correct', () => {
      it('should validate it if it\'s 0', () => {
        const paymentData = {
          installments: 2,
          amountInCents: 100,
          interestInCents: 0,
          clientReference: 'client_reference_1',
        };
        return expect(gatewayMethod.validateInterest(paymentData))
          .to.be.fulfilled;
      });

      it('should validate it if it\'s negative', () => {
        const paymentData = {
          installments: 1,
          amountInCents: 100,
          interestInCents: -5,
          clientReference: 'client_reference_1',
        };
        return expect(gatewayMethod.validateInterest(paymentData))
          .to.be.fulfilled;
      });

      it('should validate it if it\'s positive', () => {
        const paymentData = {
          installments: 3,
          amountInCents: 100,
          interestInCents: 3,
          clientReference: 'client_reference_1',
        };
        return expect(gatewayMethod.validateInterest(paymentData))
          .to.be.fulfilled;
      });

      it('should validate it if declared interest is exactly one cent more than expected', () => {
        const paymentData = {
          installments: 1,
          amountInCents: 100,
          interestInCents: -6, // Correct would be -5
          clientReference: 'client_reference_1',
        };
        return expect(gatewayMethod.validateInterest(paymentData))
          .to.be.fulfilled;
      });

      it('should validate it if declared interest is exactly one cent less than expected', () => {
        const paymentData = {
          installments: 1,
          amountInCents: 100,
          interestInCents: -4, // Correct would be -5
          clientReference: 'client_reference_1',
        };
        return expect(gatewayMethod.validateInterest(paymentData))
          .to.be.fulfilled;
      });
    });

    it('should reject if number of instalments is invalid', () => {
      const paymentData = {
        installments: 5,
        amountInCents: 100,
        interestInCents: 0,
        clientReference: 'client_reference_1',
      };
      return expect(gatewayMethod.validateInterest(paymentData))
        .to.be.rejectedWith(errors.InvalidAmountOfInstallments);
    });

    it('should reject if amount of the interest is invalid', () => {
      const paymentData = {
        installments: 3,
        amountInCents: 100,
        interestInCents: 0,
        clientReference: 'client_reference_1',
      };
      return expect(gatewayMethod.validateInterest(paymentData))
        .to.be.rejectedWith(errors.InterestMismatchError);
    });
  });

  describe('#getExpirationDateOnCreation', () => {

    const testData = [
      {
        name: 'two days',
        now: Date.parse('2020-03-16T18:47:03Z'), // Monday
        expectedDate: Date.parse('2020-03-18T18:47:03Z'), // Wednesday
        pre_execute_ttl: null, // No pre execute.
        post_execute_ttl: 2880, // Two days
        payment_ttl_include_weekends: true,
      },
      {
        name: 'two days including weekend',
        now: Date.parse('2017-09-08T09:00:00Z'), // Friday
        expectedDate: Date.parse('2017-09-10T09:00:00Z'), // Sunday
        pre_execute_ttl: null, // No pre execute.
        post_execute_ttl: 2880, // Two days
        payment_ttl_include_weekends: true,
      },
      {
        name: 'ten days',
        now: Date.parse('2017-09-08T09:00:00Z'), // Friday
        expectedDate: Date.parse('2017-09-18T09:00:00Z'), // Monday
        post_execute_ttl: 14400, // Ten days
        payment_ttl_include_weekends: true,
      },
      {
        name: 'exactly one day',
        now: Date.parse('2020-03-16T00:00:00Z'), // Monday
        expectedDate: Date.parse('2020-03-17T00:00:00Z'), // Tuesday
        pre_execute_ttl: null, // No pre execute.
        post_execute_ttl: 1440, // One day
        payment_ttl_include_weekends: true,
      },
      {
        name: 'exactly ten minutes',
        now: Date.parse('2020-03-16T00:00:00Z'), // Monday
        expectedDate: Date.parse('2020-03-16T00:10:00Z'), // Monday
        pre_execute_ttl: null, // No pre execute.
        post_execute_ttl: 10, // Ten minutes
        payment_ttl_include_weekends: true,
      },
      {
        name: 'exactly ten minutes including weekend',
        now: Date.parse('2017-09-08T23:59:00Z'), // Friday
        expectedDate: Date.parse('2017-09-09T00:09:00Z'), // Saturday
        pre_execute_ttl: null, // No pre execute.
        post_execute_ttl: 10, // Ten minutes
        payment_ttl_include_weekends: true,
      },
      {
        name: 'two days including weekend',
        now: Date.parse('2017-09-08T09:00:00Z'), // Friday
        expectedDate: Date.parse('2017-09-12T09:00:01Z'), // Tuesday
        pre_execute_ttl: null, // No pre execute.
        post_execute_ttl: 2880, // Two days
        payment_ttl_include_weekends: false,
      },
      {
        name: 'two weeks (ten business days)',
        now: Date.parse('2017-09-08T09:00:00Z'), // Friday
        expectedDate: Date.parse('2017-09-22T09:00:02Z'), // Friday
        pre_execute_ttl: null, // No pre execute.
        post_execute_ttl: 14400, // Ten days
        payment_ttl_include_weekends: false,
      },
      {
        name: 'exactly ten minutes including weekend',
        now: Date.parse('2017-09-08T23:59:00Z'), // Friday
        expectedDate: Date.parse('2017-09-11T00:09:01Z'), // Monday
        pre_execute_ttl: null, // No pre execute.
        post_execute_ttl: 10, // Ten minutes
        payment_ttl_include_weekends: false,
      },
      {
        name: 'exactly ten minutes including weekend',
        now: Date.parse('2017-09-08T23:59:00Z'), // Friday
        expectedDate: Date.parse('2017-09-11T00:09:01Z'), // Monday
        pre_execute_ttl: 10, // Ten minutes
        post_execute_ttl: 60, // One hour (should not use this)
        payment_ttl_include_weekends: false,
      },
    ];

    let clock;

    afterEach(() => {
      clock.restore();
    });

    _.each(testData, (test) => {
      it(`should correctly add ${test.name} to the current date`, (done) => {
        clock = sinon.useFakeTimers(test.now);

        const getMock = sinon.stub();
        getMock.withArgs('post_execute_ttl').returns(test.post_execute_ttl);
        getMock.withArgs('pre_execute_ttl').returns(test.pre_execute_ttl);
        getMock.withArgs('payment_ttl_include_weekends').returns(test.payment_ttl_include_weekends);
        gatewayMethod.get = getMock;

        const expirationDate = gatewayMethod.getExpirationDateOnCreation();
        expect(expirationDate.format()).to.equal(moment(test.expectedDate).utc().format());
        done();
      });
    });

  });

  describe('#getExpirationDateAfterExecute', () => {

    const testData = [
      {
        name: 'two days',
        now: Date.parse('2020-03-16T18:47:03Z'), // Monday
        expectedDate: Date.parse('2020-03-18T18:47:03Z'), // Wednesday
        post_execute_ttl: 2880, // Two days
        payment_ttl_include_weekends: true,
      },
      {
        name: 'two days including weekend',
        now: Date.parse('2017-09-08T09:00:00Z'), // Friday
        expectedDate: Date.parse('2017-09-10T09:00:00Z'), // Sunday
        post_execute_ttl: 2880, // Two days
        payment_ttl_include_weekends: true,
      },
      {
        name: 'ten days',
        now: Date.parse('2017-09-08T09:00:00Z'), // Friday
        expectedDate: Date.parse('2017-09-18T09:00:00Z'), // Monday
        post_execute_ttl: 14400, // Ten days
        payment_ttl_include_weekends: true,
      },
      {
        name: 'exactly one day',
        now: Date.parse('2020-03-16T00:00:00Z'), // Monday
        expectedDate: Date.parse('2020-03-17T00:00:00Z'), // Tuesday
        post_execute_ttl: 1440, // One day
        payment_ttl_include_weekends: true,
      },
      {
        name: 'exactly ten minutes',
        now: Date.parse('2020-03-16T00:00:00Z'), // Monday
        expectedDate: Date.parse('2020-03-16T00:10:00Z'), // Monday
        post_execute_ttl: 10, // Ten minutes
        payment_ttl_include_weekends: true,
      },
      {
        name: 'exactly ten minutes including weekend',
        now: Date.parse('2017-09-08T23:59:00Z'), // Friday
        expectedDate: Date.parse('2017-09-09T00:09:00Z'), // Saturday
        post_execute_ttl: 10, // Ten minutes
        payment_ttl_include_weekends: true,
      },
      {
        name: 'two days including weekend',
        now: Date.parse('2017-09-08T09:00:00Z'), // Friday
        expectedDate: Date.parse('2017-09-12T09:00:01Z'), // Tuesday
        post_execute_ttl: 2880, // Two days
        payment_ttl_include_weekends: false,
      },
      {
        name: 'two weeks (ten business days)',
        now: Date.parse('2017-09-08T09:00:00Z'), // Friday
        expectedDate: Date.parse('2017-09-22T09:00:02Z'), // Friday
        post_execute_ttl: 14400, // Ten days
        payment_ttl_include_weekends: false,
      },
      {
        name: 'exactly ten minutes excluding weekend',
        now: Date.parse('2017-09-08T23:59:00Z'), // Friday
        expectedDate: Date.parse('2017-09-11T00:09:01Z'), // Monday
        post_execute_ttl: 10, // Ten minutes
        payment_ttl_include_weekends: false,
      },
    ];

    let clock;

    _.each(testData, (test) => {

      it(`should correctly add ${test.name} to the payment date`, (done) => {

        const getMock = sinon.stub();
        getMock.withArgs('post_execute_ttl').returns(test.post_execute_ttl);
        getMock.withArgs('payment_ttl_include_weekends').returns(test.payment_ttl_include_weekends);
        gatewayMethod.get = getMock;

        payment.set('expiration_date', test.now);

        const expirationDate = gatewayMethod.getExpirationDateAfterExecute(payment);

        expect(expirationDate.utc().format()).to.equal(moment(test.expectedDate).utc().format());
        done();
      });
    });

  });

});

let mockSendPaymentStatusResponse = (status, statusDetail) => {
  return resolve({
    paymentStatus: status,
    statusDetail,
    installments: 6,
    type: 'creditCard',
    gatewayReference: 'GatewayReference',
    metadata: {
      mercadoPagoId: 'GatewayReference',
      collectorId: 100000000,
      issuerId: '10',
      authorizationCode: 1234,
    },
    shouldRetry: false,
  });
};

let mockSendPaymentRedirectResponse = (status, statusDetail) => {
  return resolve({
    paymentStatus: status,
    statusDetail,
    installments: 6,
    type: 'creditCard',
    gatewayReference: 'GatewayReference',
    metadata: {
      mercadoPagoId: 'GatewayReference',
      collectorId: 100000000,
      issuerId: '10',
      authorizationCode: 1234,
    },
    redirectUrl: 'www.example.com',
    shouldRetry: false,
  });
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
