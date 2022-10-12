'use strict';

const _ = require('lodash');
const sinon = require('sinon');
const expect = require('chai').expect;
const assert = require('chai').assert;
const Promise = require('bluebird');
const PaymentStatus = require('../../../src/models/constants/payment_status');
const GatewayMethod = require('../../../src/models/gateway_method.js');
const PaymentOrder = require('../../../src/models/payment_order.js');
const PaymentMethod = require('../../../src/models/payment_method.js');
const Payment = require('../../../src/models/payment.js');
const knex = require('../../../src/bookshelf').knex;
const errors = require('../../../src/errors');

describe('PaymentMethod', () => {
  let gatewayMethod;
  let paymentMethod;
  let paymentOrder;
  let singlePaymentOrder;
  let payment1;
  let payment2;
  const paymentData = {
    CR_16: {
      installments: 6,
      amountInCents: 100000,
      interestInCents: 10000,
      type: 'creditCard',

      paymentInformation: {
        processor: 'visa',
        lastFourDigits: 1234,
        firstSixDigits: 123456,
        holderDocumentNumber: 40111222
      },

      encryptedCreditCards: [{
        encryptedContent: 'mp_credit_card_token',
        encryptionType: 'mercadopagoToken'
      }]
    },
    CR_17: {
      installments: 6,
      amountInCents: 100000,
      interestInCents: 10000,
      type: 'creditCard',

      paymentInformation: {
        processor: 'visa',
        lastFourDigits: 1234,
        firstSixDigits: 123456,
        holderDocumentNumber: 40111222
      },

      encryptedCreditCards: [{
        encryptedContent: 'cybersource_credit_card_token',
        encryptionType: 'cybersourceToken'
      }]
    },
    CR_18: {
      installments: 6,
      amountInCents: 100000,
      interestInCents: 10000,
      type: 'creditCard',

      paymentInformation: {
        processor: 'visa',
        lastFourDigits: 1234,
        firstSixDigits: 123456,
        holderDocumentNumber: 40111222
      },

      encryptedCreditCards: [{
        encryptedContent: 'adyen_credit_card_token',
        encryptionType: 'adyen'
      }]
    },
  };

  beforeEach(() => {
    const paymentMethodPromise = knex('payment_methods')
      .insert([{
        id: 1,
        gateway_method_id: 1,
        type: 'TWO_CREDIT_CARDS',
        tenant_id: 1,
        name: 'Two credit cards',
        enabled: true,
      },
      {
        id: 2,
        gateway_method_id: 3,
        type: 'TICKET',
        tenant_id: 1,
        name: 'TICKET',
        enabled: true,
      },
      {
        id: 3,
        gateway_method_id: 4,
        type: 'PAYPAL',
        tenant_id: 1,
        name: 'PAYPAL',
        enabled: true,
      },
      {
        id: 4,
        gateway_method_id: 5,
        type: 'TOTVS',
        tenant_id: 1,
        name: 'TOTVS',
        enabled: true,
      }])
      .then(() => PaymentMethod.forge({ id: 1 }).fetch())
      .then(pm => paymentMethod = pm);

    const gatewayPromise = knex('gateways').insert({
      type: 'MERCADOPAGO',
      tenant_id: 1,
    }).then();

    const gatewayMethodPromise = knex('gateway_methods')
      .insert([{
        id: 1,
        tenant_id: 1,
        type: 'MERCADOPAGO_CC',
        name: 'MethodA',
        enabled: true,
        payment_method_id: 1,
        syncronic_notify_on_creation: true
      }, {
        id: 2,
        tenant_id: 1,
        type: 'ADYEN_CC',
        name: 'MethodB',
        enabled: true,
        payment_method_id: 1,
        syncronic_notify_on_creation: true
      },
      {
        id: 3,
        tenant_id: 1,
        type: 'MERCADOPAGO_TICKET',
        name: 'MethodA',
        enabled: true,
        payment_method_id: 2,
        syncronic_notify_on_creation: true
      },
      {
        id: 4,
        tenant_id: 1,
        type: 'PAYPAL',
        name: 'MethodA',
        enabled: true,
        payment_method_id: 3,
        syncronic_notify_on_creation: true
      },
      {
        id: 5,
        tenant_id: 1,
        type: 'TOTVS',
        name: 'MethodA',
        enabled: true,
        payment_method_id: 4,
        syncronic_notify_on_creation: true
      }])
      .then(() => GatewayMethod.forge({ id: 1 }).fetch())
      .then(gm => gatewayMethod = gm);

    const paymentMethodGatewayMethodPromise = knex('payment_method_gateway_methods')
      .insert([{
        id: 1,
        payment_method_id: 1,
        gateway_method_id: 1,
        gateway_method_order: 1
      },
      {
        id: 2,
        payment_method_id: 2,
        gateway_method_id: 3,
        gateway_method_order: 1
      },
      {
        id: 3,
        payment_method_id: 3,
        gateway_method_id: 4,
        gateway_method_order: 1
      }])
      .then();

    const paymentsPromise = Promise.map([16, 17, 18], (id) => {
      return knex('payments').insert({
        id,
        client_reference: `CR_${id}`,
        status_id: PaymentStatus.authorized,
        payment_order_id: 20,
        gateway_method_id: 1,
      });
    })
      .then(() => {
        return Promise.all([
          Payment.forge({ id: 16 }).fetch(),
          Payment.forge({ id: 17 }).fetch()
        ])
          .then((payments) => {
            payment1 = payments[0];
            payment2 = payments[1];
            return Promise.resolve({});
          });
      });

    const singlePaymentsPromise = knex('payments').insert({
      id: 19,
      client_reference: 'CR_19',
      status_id: PaymentStatus.successful,
      payment_order_id: 30,
      gateway_method_id: 1,
    });

    const singlePaymentOrderPromise = knex('payment_orders')
      .insert({
        id: 30,
        payment_method_id: 1,
        currency: 'BRL',
        reference: 'REFERENCE',
        buyer_id: 25,
        tenant_id: 1,
        total: 548,
        interest: 54.8,
      })
      .then(() => PaymentOrder.forge({ id: 30 }).fetch())
      .then(po => singlePaymentOrder = po);

    const paymentOrderPromise = knex('payment_orders')
      .insert({
        id: 20,
        purchase_reference: 'purchase_reference',
        reference: 'reference',
        status_id: PaymentStatus.creating,
        payment_method_id: 1,
        currency: 'BRL',
        buyer_id: 51,
        tenant_id: 1,
        total: 300,
        interest: 30,
      })
      .then(() => PaymentOrder.forge({ id: 20 }).fetch())
      .then(po => paymentOrder = po);

    return Promise.all([
      paymentsPromise,
      gatewayPromise,
      gatewayMethodPromise,
      paymentMethodGatewayMethodPromise,
      singlePaymentsPromise,
      paymentOrderPromise,
      singlePaymentOrderPromise,
      paymentMethodPromise,
    ]);
  });

  describe('#updateClientReference', () => {
    it('update client reference with 1 digits', () => {
      const clientReference = 'client_reference_1_1';
      const newClientReference = paymentMethod.updateClientReference(clientReference, 2);
      assert.equal(newClientReference, 'client_reference_1_2');
    });

    it('update client reference with 2 digits', () => {
      const clientReference = 'client_reference_1_11';
      const newClientReference = paymentMethod.updateClientReference(clientReference, 12);
      assert.equal(newClientReference, 'client_reference_1_12');
    });
  });

  describe('#createOrRetryPayment', () => {
    const paymentsData = _.clone(require('../../fixtures/paymentCreationRequest/payment_order_three_payments.json'), true);
    let paymentRetried;
    let paymentOrderForRetry;

    beforeEach(() => {
      gatewayMethod.createPayment = sinon.spy((data, opts) => Payment.create(gatewayMethod, data, opts));
      const payemntPromise = knex('payments').insert({
        id: 11,
        currency: 'CUR',
        amount: 34.20,
        interest: 3.42,
        type: 'creditCard',
        status_id: PaymentStatus.creating,
        gateway_method_id: 1,
        tenant_id: 1,
        client_reference: 'CLIENT_REFERENCE_1',
        status_detail: 'unknown',
        expiration_date: new Date(),
        payment_order_id: 10,
        retried_with_payment_id: null,
      }).then(() => Payment.forge({ id: 11 }).fetch())
        .then(p => paymentRetried = p);

      const paymentOrderPromise = knex('payment_orders').insert({
        id: 10,
        payment_method_id: 1,
        currency: 'BRL',
        reference: 'REFERENCE',
        buyer_id: 25,
        tenant_id: 1,
        total: 548,
        interest: 54.8,
      })
        .then(() => PaymentOrder.forge({ id: 10 }).fetch())
        .then(po => paymentOrderForRetry = po);

      return Promise.all([paymentOrderPromise, payemntPromise]);
    });

    it('Should create a single payment', () => {
      const paymentData = paymentsData.paymentOrder.payments[0];
      paymentData.currency = 'BRL';
      paymentData.clientReference = 'CLIENT_REFERENCE_1';
      paymentData.expiration_date = new Date('2019-01-21T15:13:14.774000Z');

      return expect(paymentMethod.createOrRetryPayment(gatewayMethod, paymentData, null))
        .to.be.fulfilled
        .then((payment) => {
          assert.equal(payment.get('status_id'),PaymentStatus.creating);
        });
    });

    it('Should retry a payment if previousPaymet is received', () => {
      const paymentData = paymentsData.paymentOrder.payments[0];
      paymentData.currency = 'BRL';
      paymentData.clientReference = 'CLIENT_REFERENCE_1';
      paymentData.expiration_date = new Date('2019-01-21T15:13:14.774000Z');

      return expect(paymentMethod.createOrRetryPayment(gatewayMethod, paymentData, paymentRetried))
        .to.be.fulfilled
        .then((payment) => {
          paymentRetried.refresh()
            .then((p) => {
              assert.equal(payment.get('status_id'),PaymentStatus.creating);
              assert.equal(p.get('retried_with_payment_id'),payment.get('id'));
            });
        });
    });

    it('Should reject if fail to retry', () => {
      const paymentData = paymentsData.paymentOrder.payments[0];
      paymentData.currency = 'BRL';
      paymentData.clientReference = 'CLIENT_REFERENCE_1';
      paymentData.expiration_date = new Date('2019-01-21T15:13:14.774000Z');

      const anError = new Error('fail at save the retry');
      paymentRetried.save = sinon.spy(() => reject(anError));

      return expect(paymentMethod.createOrRetryPayment(gatewayMethod, paymentData, paymentRetried))
        .to.be.rejected
        .then((err) => {
          assert.equal(err, anError);
          return paymentOrderForRetry.getRelation('validPayments')
            .then((payments) => {
              assert.equal(payments.length, 1);
              assert.equal(payments.first().get('id'), paymentRetried.get('id'));
            });
        });
    });

    it('Should reject if fail to create new payment ', () => {
      const paymentData = paymentsData.paymentOrder.payments[0];
      paymentData.currency = 'BRL';
      paymentData.clientReference = 'CLIENT_REFERENCE_1';
      paymentData.expiration_date = new Date('2019-01-21T15:13:14.774000Z');

      const anError = new Error('fail at create payment');
      gatewayMethod.createPayment = sinon.spy(() => reject(anError));

      return expect(paymentMethod.createOrRetryPayment(gatewayMethod, paymentData, null))
        .to.be.rejected
        .then((err) => {
          assert.equal(err, anError);
          return paymentOrderForRetry.getRelation('validPayments')
            .then((payments) => {
              assert.equal(payments.length, 1);
              assert.equal(payments.first().get('id'), paymentRetried.get('id'));
            });
        });
    });
  });

  describe('#PaymentRetry', () => {
    let paymentRetried;
    let newPayment;

    beforeEach(() => {
      return knex('payments').insert([{
        id: 10,
        currency: 'CUR',
        amount: 34.20,
        interest: 3.42,
        type: 'creditCard',
        status_id: PaymentStatus.authorized,
        gateway_method_id: 1,
        tenant_id: 1,
        client_reference: 'CLIENT_REFERENCE_1',
        status_detail: 'unknown',
        expiration_date: new Date(),
        payment_order_id: 10,
        retried_with_payment_id: 11,
      },
      {
        id: 11,
        currency: 'CUR',
        amount: 34.20,
        interest: 3.42,
        type: 'creditCard',
        status_id: PaymentStatus.creating,
        gateway_method_id: 1,
        tenant_id: 1,
        client_reference: 'CLIENT_REFERENCE_1',
        status_detail: 'unknown',
        expiration_date: new Date(),
        payment_order_id: 10,
        retried_with_payment_id: null,
      },
      ])
        .then(() => {
          return Promise.all([
            Payment.forge({ id: 10 }).fetch(),
            Payment.forge({ id: 11 }).fetch()
          ])
            .then((payments) => {
              paymentRetried = payments[0];
              newPayment = payments[1];
              return Promise.resolve({});
            });
        });

    });

    describe('#setLastValidPayment', () => {
      it('should let valid the actual payment', () => {
        return expect(paymentMethod.setLastValidPayment(newPayment))
          .to.be.fulfilled
          .then(() => {
            return newPayment.refresh()
              .then((p) => {
                assert.equal(p.get('retried_with_payment_id'), null);
                assert.equal(paymentRetried.get('retried_with_payment_id'), p.get('id'));
              });
          });
      });

      it('should switch valid payment to the previous valid payment', () => {
        return expect(paymentMethod.setLastValidPayment(paymentRetried))
          .to.be.fulfilled
          .then(() => {
            const paymentRetriedPromise = paymentRetried.refresh()
              .then(p => assert.equal(p.get('retried_with_payment_id'), null));

            const newPaymentPromise = newPayment.refresh()
              .then(p => assert.equal(p.get('retried_with_payment_id'), paymentRetried.get('id')));
            return Promise.all([paymentRetriedPromise, newPaymentPromise]);
          });
      });

      it('should throw an error if there is no previous valid payment', () => {
        return expect(paymentMethod.setLastValidPayment())
          .to.be.rejected
          .then((error) => {
            assert.equal(error.message, 'there is no previous valid payment');
          });
      });
    });

  });

  describe('#processPaymentWithRetries', () => {
    let gatewayMethodShouldNotRetry;
    let gatewayMethodShouldRetry;

    beforeEach(() => {
      const gm1Promise = GatewayMethod.forge({ id: 1 }).fetch().then(gm => gatewayMethodShouldNotRetry = gm);
      const gm2Promise = GatewayMethod.forge({ id: 2 }).fetch().then(gm => gatewayMethodShouldRetry = gm);
      payment1.save = sinon.spy(() => resolve({}));
      payment2.save = sinon.spy(() => resolve({}));
      paymentMethod.setLastValidPayment = sinon.spy(() => resolve({}))

      return Promise.all([gm1Promise, gm2Promise])
        .then(() => {
          gatewayMethodShouldNotRetry.createPayment = sinon.spy(() => resolve(payment1));
          gatewayMethodShouldNotRetry.processPayment = sinon.spy(() => resolve({ should_retry: false, message: 'payment_success'  }));
          gatewayMethodShouldRetry.createPayment = sinon.spy(() => resolve(payment2));
          gatewayMethodShouldRetry.processPayment = sinon.spy(() => resolve({ should_retry: true, message: 'payment_failed' }));

        });
    });

    it('should process payment with frist gateway', () => {
      const gmList = [gatewayMethodShouldNotRetry, gatewayMethodShouldRetry];
      const onePaymentData = _.valuesIn(paymentData)[0];
      onePaymentData.clientReference = 'client_reference_1';

      return expect(paymentMethod.processPaymentWithRetries(gmList, onePaymentData, paymentOrder))
        .to.be.fulfilled
        .then(() => {
          assert.equal(gatewayMethodShouldNotRetry.processPayment.callCount, 1);
          assert.equal(gatewayMethodShouldRetry.processPayment.callCount, 0);
        });
    });

    it('should process payment with the second gateway after fail with the first one', () => {
      const gmList = [gatewayMethodShouldRetry, gatewayMethodShouldNotRetry];
      const onePaymentData = _.valuesIn(paymentData)[0];
      onePaymentData.clientReference = 'client_reference_1';

      return expect(paymentMethod.processPaymentWithRetries(gmList, onePaymentData, paymentOrder))
        .to.be.fulfilled
        .then(() => {
          assert.equal(gatewayMethodShouldNotRetry.processPayment.callCount, 1);
          assert.equal(gatewayMethodShouldRetry.processPayment.callCount, 1);
          assert.equal(payment2.save.callCount, 1);
          assert.equal(payment2.get('retried_with_payment_id'), payment1.get('id'));
        });
    });

    it('should call setLastValidPayment if fail at retry the second payment ', () => {
      const gmList = [gatewayMethodShouldRetry, gatewayMethodShouldNotRetry];
      const onePaymentData = _.valuesIn(paymentData)[0];
      onePaymentData.clientReference = 'client_reference_1';
      payment2.save = sinon.spy(() => reject({})); // fail at update the retied_payment

      return expect(paymentMethod.processPaymentWithRetries(gmList, onePaymentData, paymentOrder))
        .to.be.fulfilled
        .then(() => {
          assert.equal(gatewayMethodShouldRetry.createPayment.callCount, 1);
          assert.equal(gatewayMethodShouldRetry.processPayment.callCount, 1);

          assert.equal(gatewayMethodShouldNotRetry.createPayment.callCount, 1);
          assert.equal(gatewayMethodShouldNotRetry.processPayment.callCount, 0);

          assert.equal(paymentMethod.setLastValidPayment.callCount, 1);
        });
    });

    it('should call setLastValidPayment if fail at process the second payment ', () => {
      const gmList = [gatewayMethodShouldRetry, gatewayMethodShouldNotRetry];
      const onePaymentData = _.valuesIn(paymentData)[0];
      onePaymentData.clientReference = 'client_reference_1';
      gatewayMethodShouldNotRetry.processPayment = sinon.spy(() => reject({})); //fail at process the second payment

      return expect(paymentMethod.processPaymentWithRetries(gmList, onePaymentData, paymentOrder))
        .to.be.fulfilled
        .then(() => {
          assert.equal(gatewayMethodShouldRetry.createPayment.callCount, 1);
          assert.equal(gatewayMethodShouldRetry.processPayment.callCount, 1);

          assert.equal(gatewayMethodShouldNotRetry.createPayment.callCount, 1);
          assert.equal(gatewayMethodShouldNotRetry.processPayment.callCount, 1);

          assert.equal(paymentMethod.setLastValidPayment.callCount, 1);
        });
    });

  });

  describe('#processPaymentOrder', () => {
    beforeEach(() => {
      paymentMethod.processPaymentWithRetries = sinon.spy(() => resolve({}));
      paymentMethod.selectGatewayMethods = sinon.spy(() => resolve({}));
    });

    it('should process each payment with its gatewayMethod and succeed if every payment succeeds', () => {
      paymentMethod.cancelPaymentOrder = sinon.spy(() => resolve({}));
      paymentMethod.calculateStatus = sinon.spy(() => resolve(PaymentStatus.pendingAuthorize));

      return expect(paymentMethod.processPaymentOrder(paymentOrder, paymentData))
        .to.be.fulfilled
        .then((result) => {
          assert.equal(paymentMethod.processPaymentWithRetries.callCount, 3);
          assert.equal(paymentMethod.cancelPaymentOrder.callCount, 0);
          assert.deepEqual(result, {
            action: {
              type: 'status',
              data: {
                paymentOrderStatus: PaymentStatus.pendingAuthorize,
                reference: 'reference',
                purchaseReference: 'purchase_reference',
              },
            },
          });
        });
    });

    it('should cancel all payments if the paymentOrder status is rejected', () => {
      paymentOrder.set('status_id', PaymentStatus.rejected);
      paymentMethod.calculateStatus = sinon.spy(() => resolve(PaymentStatus.rejected));
      paymentMethod.cancelPaymentOrder = sinon.spy(() => resolve({}));

      return expect(paymentMethod.processPaymentOrder(paymentOrder, paymentData))
        .to.be.fulfilled
        .then((result) => {
          assert.equal(paymentMethod.processPaymentWithRetries.callCount, 3);
          assert.equal(paymentMethod.cancelPaymentOrder.callCount, 1);
          assert.deepEqual(result, {
            action: {
              type: 'status',
              data: {
                paymentOrderStatus: PaymentStatus.rejected,
                reference: 'reference',
                purchaseReference: 'purchase_reference',
              },
            },
          });
        });
    });

    it('should fail if a single payment fails and then cancel the others', () => {
      paymentMethod.processPaymentWithRetries = sinon.spy(() => reject({}));
      paymentMethod.cancelPaymentOrder = sinon.spy(() => resolve({}));

      return expect(paymentMethod.processPaymentOrder(paymentOrder, paymentData))
        .to.be.rejected
        .then((err) => {
          assert.equal(paymentMethod.processPaymentWithRetries.callCount, 3);
          assert.equal(paymentMethod.cancelPaymentOrder.callCount, 1);
        });
    });

    it('should reject with the original error if a payment fails creation but the cancel also fails', () => {
      const anError = new Error('processing payment');
      paymentMethod.processPaymentWithRetries = sinon.spy(() => reject(anError));
      paymentMethod.cancelPaymentOrder = sinon.spy(() => reject(new Error('A payment failed to cancel')));

      return expect(paymentMethod.processPaymentOrder(paymentOrder, paymentData))
        .to.be.rejected
        .then((err) => {
          assert.equal(paymentOrder.get('status_id'), PaymentStatus.error);
          assert.equal(err, anError);
          assert.equal(paymentMethod.processPaymentWithRetries.callCount, 3);
          assert.equal(paymentMethod.cancelPaymentOrder.callCount, 1);
        });
    });

    it('should not fail if it tries to cancel all payments but some of them fails', () => {
      paymentOrder.set('status_id', PaymentStatus.rejected);
      paymentMethod.calculateStatus = sinon.spy(() => resolve(PaymentStatus.rejected));
      paymentMethod.cancelPaymentOrder = sinon.spy(() => reject(new Error('A payment failed to cancel')));

      return expect(paymentMethod.processPaymentOrder(paymentOrder, paymentData))
        .to.be.fulfilled
        .then((result) => {
          assert.equal(paymentMethod.processPaymentWithRetries.callCount, 3);
          assert.equal(paymentMethod.cancelPaymentOrder.callCount, 1);
          assert.deepEqual(result, {
            action: {
              type: 'status',
              data: {
                paymentOrderStatus: PaymentStatus.rejected,
                reference: 'reference',
                purchaseReference: 'purchase_reference',
              },
            },
          });
        });
    });

  });

  describe('#selectGatewayMethod', () => {
    it('should throw an error if paymentData has no encryption', () => {
      return expect(paymentMethod.selectGatewayMethod({}))
        .to.be.rejected
        .then((errs) => {
          const error = new errors.InvalidEncryptionTypes();
          expect(errs).to.deep.equal(error);
        });
    });

    it('should select the same gateway method as the default if paymentData indicates it', () => {
      return expect(paymentMethod.selectGatewayMethod({
          encryptedCreditCards: [{
            encryptedContent: 'mp_credit_card_token',
            encryptionType: 'mercadopagoToken',
          }],
        }))
        .to.be.fulfilled
        .then((gm) => {
          assert.isNotNull(gm);
          assert.instanceOf(gm, GatewayMethod);
          assert.equal(gm.type, 'MERCADOPAGO_CC');
        });
    });

    it('should throw an error if paymentData has a invalid token', () => {
      return expect(paymentMethod.selectGatewayMethod({
          encryptedCreditCards: [{
            encryptedContent: 'atoken',
            encryptionType: 'notAToken',
          }],
        }))
        .to.be.rejected
        .then((errs) => {
          const error = new errors.InvalidEncryptionTypes();
          expect(errs).to.deep.equal(error);
        });
    });

    // Modela el caso real de adyen, es un token valido pero ya no es valido el gm adyen
    it('should throw an error if paymentData has a valid token but the gateway method cant be selected for that payment method', () => {
      return expect(paymentMethod.selectGatewayMethod({
          encryptedCreditCards: [{
          encryptedContent: 'cyber_credit_card_token',
            encryptionType: 'cybersourceToken',
          }]
        }))
        .to.be.rejected
        .then((errs) => {
          const error = new errors.InvalidEncryptionTypes();
          expect(errs).to.deep.equal(error);
        });
    });

    it('should select other gateway method as the default if paymentData indicates it', () => {
      return expect(paymentMethod.selectGatewayMethod({
          encryptedCreditCards: [{
            encryptedContent: 'adyen_credit_card_token',
            encryptionType: 'adyen'
          }]
        }))
        .to.be.fulfilled
        .then((gm) => {
          assert.isNotNull(gm);
          assert.instanceOf(gm, GatewayMethod);
          assert.equal(gm.type, 'ADYEN_CC');
        });
    });


  });

  describe('#selectGatewayMethods', () => {
    describe('#credit card cases ', () => {
      it('should throw an error if paymentData has no encryption on credit card payment', () => {
        return expect(paymentMethod.selectGatewayMethods({}))
          .to.be.rejected
          .then((errs) => {
            const error = new errors.InvalidEncryptionTypes();
            expect(errs).to.deep.equal(error);
          });
      });


      it('should throw an error if has invalid token type on credit card payment', () => {
        return expect(paymentMethod.selectGatewayMethods({
          encryptedCreditCards: [{
            encryptedContent: 'invalid_token',
            encryptionType: 'invalid_token_type',
          }],
        }))
          .to.be.rejected
          .then((errs) => {
            const error = new errors.InvalidEncryptionTypes();
            expect(errs).to.deep.equal(error);
          });
      });

      it('should select gateway method in paymentData if it is in the oderdered gms', () => {
        return expect(paymentMethod.selectGatewayMethods({
          encryptedCreditCards: [{
            encryptedContent: 'mp_credit_card_token',
            encryptionType: 'mercadopagoToken',
          }],
        }))
          .to.be.fulfilled
          .then((gms) => {
            assert.isNotNull(gms);
            assert.isArray(gms);
            assert.equal(gms.length, 1);
            assert.instanceOf(gms[0], GatewayMethod);
            assert.equal(gms[0].type, 'MERCADOPAGO_CC');
          });
      });

      it('should select the gateway method in ordered gms if payment_data has 2 valid tokens', () => {
        return expect(paymentMethod.selectGatewayMethods({
          encryptedCreditCards: [{
            encryptedContent: 'mp_credit_card_token',
            encryptionType: 'mercadopagoToken',
          },
          {
            encryptedContent: 'adyen_credit_card_token',
            encryptionType: 'adyen',
          }],
        }))
          .to.be.fulfilled
          .then((gms) => {
            assert.isNotNull(gms);
            assert.isArray(gms);
            assert.equal(gms.length, 1);
            assert.instanceOf(gms[0], GatewayMethod);
            assert.equal(gms[0].type, 'MERCADOPAGO_CC');
          });
      });

      it('should select other gateway method as the default if paymentData indicates it', () => {
        return expect(paymentMethod.selectGatewayMethods({
          encryptedCreditCards: [{
            encryptedContent: 'adyen_credit_card_token',
            encryptionType: 'adyen'
          }]
        }))
          .to.be.fulfilled
          .then((gms) => {
            assert.isNotNull(gms);
            assert.isArray(gms);
            assert.equal(gms.length, 1);
            assert.instanceOf(gms[0], GatewayMethod);
            assert.equal(gms[0].type, 'ADYEN_CC');
          });
      });

      it('should throw an error if has a valid token but not belongs to a valid gateway method', () => {
        return expect(paymentMethod.selectGatewayMethods({
          encryptedCreditCards: [{
            encryptedContent: 'cybersource_credit_card_token',
            encryptionType: 'cybersourceToken'
          }]
        }))
          .to.be.rejected
          .then((errs) => {
            const error = new errors.InvalidEncryptionTypes();
            expect(errs).to.deep.equal(error);
          });
      });
    });

    describe('#ticket cases ', () => {
      it('should return TICKET gm', () => {
        let pmTicket;
        return PaymentMethod.forge({ id: 2 }).fetch()
          .then(pm => pmTicket = pm)
          .then(() => {
            return expect(pmTicket.selectGatewayMethods({}))
              .to.be.fulfilled
              .then((gms) => {
                assert.isNotNull(gms);
                assert.isArray(gms);
                assert.equal(gms.length, 1);
                assert.instanceOf(gms[0], GatewayMethod);
                assert.equal(gms[0].type, 'MERCADOPAGO_TICKET');
              });
          });
      });
    });

    describe('#paypal cases ', () => {
      it('should return PAYPAL gm', () => {
        let pmPaypal;
        return PaymentMethod.forge({ id: 3 }).fetch()
          .then(pm => pmPaypal = pm)
          .then(() => {
            return expect(pmPaypal.selectGatewayMethods({}))
              .to.be.fulfilled
              .then((gms) => {
                assert.isNotNull(gms);
                assert.isArray(gms);
                assert.equal(gms.length, 1);
                assert.instanceOf(gms[0], GatewayMethod);
                assert.equal(gms[0].type, 'PAYPAL');
              });
          });
      });
    });

    describe('#totvs cases ', () => {
      it('should throw an error if payment method has no gatewaymethod configuration', () => {
        let totvsPaypal;
        return PaymentMethod.forge({ id: 4 }).fetch()
          .then(pm => totvsPaypal = pm)
          .then(() => {
            return expect(totvsPaypal.selectGatewayMethods({}))
              .to.be.rejected
              .then((errs) => {
                const error = new errors.PaymentMethodWithoutConfiguredGatewayMethod();
                expect(errs).to.deep.equal(error);
              });
          });
      });

      it('should return Totvs gm', () => {
        let totvsPaypal;
        const promisePMGM = knex('payment_method_gateway_methods')
          .insert({
            id: 4,
            payment_method_id: 4,
            gateway_method_id: 5,
            gateway_method_order: 1,
          });
        const promisePM =  PaymentMethod.forge({ id: 4 }).fetch()
          .then(pm => totvsPaypal = pm);
        return Promise.all([promisePM,promisePMGM])
          .then(() => {
            return expect(totvsPaypal.selectGatewayMethods({}))
              .to.be.fulfilled
              .then((gms) => {
                assert.isNotNull(gms);
                assert.isArray(gms);
                assert.equal(gms.length, 1);
                assert.instanceOf(gms[0], GatewayMethod);
                assert.equal(gms[0].type, 'TOTVS');
              });
          });
      });
    });
  });

  describe('#shouldCapturePayments', () => {
    it('should capture payments when PaymentOrder is in authorize status', () => {
      let paymentOrder;

      const paymentPromise = knex('payments').insert({
        id: 19,
        client_reference: 'CR_19',
        type: 'creditCard',
        status_id: PaymentStatus.authorized,
        payment_order_id: 57,
      });

      const paymentOrderPromise = knex('payment_orders')
        .insert({
          id: 57,
          payment_method_id: 1,
          currency: 'BRL',
          reference: 'REFERENCE',
          buyer_id: 25,
          tenant_id: 1,
          total: 548,
          status_id: PaymentStatus.authorized,
        })
        .then(() => PaymentOrder.forge({ id: 57 }).fetch())
        .then(po => paymentOrder = po);

      const promise = Promise.all([paymentOrderPromise, paymentPromise])
        .then(() => paymentMethod.shouldCapturePayments(paymentOrder));

      return expect(promise).to.eventually.equal(true);
    });

    _.each([PaymentStatus.pendingAuthorize, PaymentStatus.pendingCapture,
      PaymentStatus.pendingCancel, PaymentStatus.creating, PaymentStatus.successful], (status) => {

      it(`should NOT capture payments when PaymentOrder is in ${status} status`, () => {
        const po = PaymentOrder.forge({
          status_id: status,
        });

        return expect(paymentMethod.shouldCapturePayments(po))
          .to.eventually.equal(false);
      });
    });
  });

  describe('#cancelPaymentOrder', () => {
    let cancelMethod;

    beforeEach(() => {
      cancelMethod = sinon.stub(Payment.prototype, 'cancel', resolve);
    });

    afterEach(() => {
      cancelMethod.restore();
    });

    it('should cancel the only payment that the payment order has', () => {
      return expect(paymentMethod.cancelPaymentOrder(singlePaymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(cancelMethod.callCount).to.be.equal(1);
          expect(cancelMethod.firstCall.thisValue.get('id')).to.be.equal(19);
        });
    });

    it('should cancel the three payments that the payment order has', () => {
      return expect(paymentMethod.cancelPaymentOrder(paymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(cancelMethod.callCount).to.be.equal(3);
          expect(_.map(cancelMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });

    it('should not cancel a rejected payment order', () => {
      let paymentOrder;
      const rejectedPaymentOrderPromise = knex('payment_orders')
        .insert({
          id: 43,
          payment_method_id: 1,
          currency: 'BRL',
          reference: 'REFERENCE',
          buyer_id: 25,
          tenant_id: 1,
          total: 548,
          status_id: PaymentStatus.rejected,
        })
        .then(() => PaymentOrder.forge({ id: 43 }).fetch())
        .then(po => paymentOrder = po);
      const rejectedPaymentPromise = knex('payments').insert({
        id: 13,
        client_reference: 'CR_13',
        status_id: PaymentStatus.rejected,
        payment_order_id: 43,
      });

      const promise = Promise.all([rejectedPaymentOrderPromise, rejectedPaymentPromise]);

      return expect(promise.then(() => paymentMethod.cancelPaymentOrder(paymentOrder)))
        .to.be.fulfilled
        .then(() => {
          expect(paymentOrder.get('status_id')).to.equal(PaymentStatus.rejected);
        });
    });

    it('should NOT skip the InvalidStateChangeError if the payment is in creating status', () => {
      return knex('payments')
        .update({ status_id: PaymentStatus.creating })
        .where({ id: 19 })
        .then(() => {
          const error = new errors.InvalidStateChangeError(PaymentStatus.creating, PaymentStatus.pendingCancel);
          const paymentOrder = new PaymentOrder({
            id: 30,
            currency: 'BRL',
            purchase_reference: 'PR_20',
            reference: 'R_20',
            payment_method_id: 1,
            buyer_id: 1,
            tenant_id: 1,
            status_id: PaymentStatus.creating,
            total: 200,
          });
          cancelMethod.restore();
          cancelMethod = sinon.stub(Payment.prototype, 'cancel', function () {
            if (this.get('id') == 19) {
              return reject(error);
            }

            return resolve();

          });

          return expect(paymentMethod.cancelPaymentOrder(paymentOrder))
            .to.be.rejected
            .then((errs) => {
              expect(errs).to.deep.equal(error);
              expect(cancelMethod.callCount).to.be.equal(1);
              expect(_.map(cancelMethod.thisValues, m => m.get('id'))).to.be.deep.equal([19]);
            });
        });
    });

    it('should skip the InvalidStateChangeError if the payment is in another status than creating', () => {
      const error = new errors.InvalidStateChangeError(PaymentStatus.pendingCancel, PaymentStatus.pendingCancel);
      cancelMethod.restore();
      cancelMethod = sinon.stub(Payment.prototype, 'cancel', () => {
        return reject(error);
      });

      return expect(paymentMethod.cancelPaymentOrder(singlePaymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(cancelMethod.callCount).to.be.equal(1);
          expect(_.map(cancelMethod.thisValues, m => m.get('id'))).to.be.deep.equal([19]);
        });
    });

    it('should reject the promise if one of the payments fails to cancel with other error than InvalidStateChangeError', () => {
      const error = new Error('Some error');
      cancelMethod.restore();
      cancelMethod = sinon.stub(Payment.prototype, 'cancel', function () {
        if (this.get('id') == 16) {
          return reject(error);
        }

        return resolve();

      });

      return expect(paymentMethod.cancelPaymentOrder(paymentOrder))
        .to.be.rejected
        .then((errs) => {
          expect(errs).to.deep.equal(error);
          expect(cancelMethod.callCount).to.be.equal(3);
          expect(_.map(cancelMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });

    it('should reject with any of the errors if some of the payments fails to cancel with other error than InvalidStateChangeError', () => {
      const error16 = new Error('Some error');
      const error17 = new Error('Some other error');
      cancelMethod.restore();
      cancelMethod = sinon.stub(Payment.prototype, 'cancel', function () {
        if (this.get('id') == 16) {
          return reject(error16);
        }
        if (this.get('id') == 17) {
          return reject(error17);
        }

        return resolve();

      });

      return expect(paymentMethod.cancelPaymentOrder(paymentOrder))
        .to.be.rejected
        .then((errs) => {
          expect(errs).to.deep.oneOf([error16, error17]);
          expect(cancelMethod.callCount).to.be.equal(3);
          expect(_.map(cancelMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });
  });

  describe('#chargeBackPaymentOrder', () => {
    let chargeBackMethod;

    beforeEach(() => {
      chargeBackMethod = sinon.stub(Payment.prototype, 'chargeBack', resolve);
    });

    afterEach(() => {
      chargeBackMethod.restore();
    });

    it('should chargeback the only payment that the payment order has', () => {
      return expect(paymentMethod.chargeBackPaymentOrder(singlePaymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(chargeBackMethod.callCount).to.be.equal(1);
          expect(chargeBackMethod.firstCall.thisValue.get('id')).to.be.equal(19);
        });
    });

    it('should chargeback the three payments that the payment order has', () => {
      return expect(paymentMethod.chargeBackPaymentOrder(paymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(chargeBackMethod.callCount).to.be.equal(3);
          expect(_.map(chargeBackMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });

    _.each([
      PaymentStatus.partialRefund,
      PaymentStatus.pendingAuthorize,
      PaymentStatus.authorized,
      PaymentStatus.creating,
      PaymentStatus.pendingCancel,
    ], (status) => {
      it(`should NOT skip the InvalidStateChangeError if the payment is in status ${status}`, () => {
        return knex('payments')
          .update({ status_id: status })
          .where({ id: 19 })
          .then(() => {
            const error = new errors.InvalidStateChangeError(status, PaymentStatus.chargedBack);
            chargeBackMethod.restore();
            chargeBackMethod = sinon.stub(Payment.prototype, 'chargeBack', function () {
              if (this.get('id') == 19) {
                return reject(error);
              }

              return resolve();

            });

            return expect(paymentMethod.chargeBackPaymentOrder(singlePaymentOrder))
              .to.be.rejected
              .then((errs) => {
                expect(errs).to.deep.equal(error);
                expect(chargeBackMethod.callCount).to.be.equal(1);
                expect(_.map(chargeBackMethod.thisValues, m => m.get('id'))).to.be.deep.equal([19]);
              });
          });
      });
    });

    it('should skip the InvalidStateChangeError if the payment is in another status than creating', () => {
      const error = new errors.InvalidStateChangeError(PaymentStatus.successful, PaymentStatus.chargedBack);
      chargeBackMethod.restore();
      chargeBackMethod = sinon.stub(Payment.prototype, 'chargeBack', () => {
        return reject(error);
      });

      return expect(paymentMethod.chargeBackPaymentOrder(singlePaymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(chargeBackMethod.callCount).to.be.equal(1);
          expect(_.map(chargeBackMethod.thisValues, m => m.get('id'))).to.be.deep.equal([19]);
        });
    });

    it('should reject the promise if one of the payments fails to chargeBack with other error than InvalidStateChangeError', () => {
      const error = new Error('Some error');
      chargeBackMethod.restore();
      chargeBackMethod = sinon.stub(Payment.prototype, 'chargeBack', function () {
        if (this.get('id') == 16) {
          return reject(error);
        }

        return resolve();

      });

      return expect(paymentMethod.chargeBackPaymentOrder(paymentOrder))
        .to.be.rejected
        .then((errs) => {
          expect(errs).to.deep.equal(error);
          expect(chargeBackMethod.callCount).to.be.equal(3);
          expect(_.map(chargeBackMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });

    it('should reject with any of the errors if some of the payments fails to chargeBack with other error than InvalidStateChangeError', () => {
      const error16 = new Error('Some error');
      const error17 = new Error('Some other error');
      chargeBackMethod.restore();
      chargeBackMethod = sinon.stub(Payment.prototype, 'chargeBack', function () {
        if (this.get('id') == 16) {
          return reject(error16);
        }
        if (this.get('id') == 17) {
          return reject(error17);
        }

        return resolve();

      });

      return expect(paymentMethod.chargeBackPaymentOrder(paymentOrder))
        .to.be.rejected
        .then((errs) => {
          expect(errs).to.deep.oneOf([error16, error17]);
          expect(chargeBackMethod.callCount).to.be.equal(3);
          expect(_.map(chargeBackMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });
  });

  describe('#manualRefundPaymentOrder', () => {
    let manualRefundMethod;

    beforeEach(() => {
      manualRefundMethod = sinon.stub(Payment.prototype, 'manualRefunded', resolve);
    });

    afterEach(() => {
      manualRefundMethod.restore();
    });

    it('should manual refund the only payment that the payment order has', () => {
      return expect(paymentMethod.manualRefundPaymentOrder(singlePaymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(manualRefundMethod.callCount).to.be.equal(1);
          expect(manualRefundMethod.firstCall.thisValue.get('id')).to.be.equal(19);
        });
    });

    it('should manual refund the three payments that the payment order has', () => {
      return expect(paymentMethod.manualRefundPaymentOrder(paymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(manualRefundMethod.callCount).to.be.equal(3);
          expect(_.map(manualRefundMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });

    _.each([
      PaymentStatus.pendingAuthorize,
      PaymentStatus.authorized,
      PaymentStatus.creating,
    ], (status) => {
      it(`should NOT skip the InvalidStateChangeError if the payment is in status ${status}`, () => {
        return knex('payments')
          .update({ status_id: status })
          .where({ id: 19 })
          .then(() => {
            const error = new errors.InvalidStateChangeError(status, PaymentStatus.chargedBack);
            manualRefundMethod.restore();
            manualRefundMethod = sinon.stub(Payment.prototype, 'manualRefunded', function () {
              if (this.get('id') == 19) {
                return reject(error);
              }

              return resolve();

            });

            return expect(paymentMethod.manualRefundPaymentOrder(singlePaymentOrder))
              .to.be.rejected
              .then((errs) => {
                expect(errs).to.deep.equal(error);
                expect(manualRefundMethod.callCount).to.be.equal(1);
                expect(_.map(manualRefundMethod.thisValues, m => m.get('id'))).to.be.deep.equal([19]);
              });
          });
      });
    });

    it('should skip the InvalidStateChangeError if the payment is in another status than creating', () => {
      const error = new errors.InvalidStateChangeError(PaymentStatus.successful, PaymentStatus.chargedBack);
      manualRefundMethod.restore();
      manualRefundMethod = sinon.stub(Payment.prototype, 'manualRefunded', () => {
        return reject(error);
      });

      return expect(paymentMethod.manualRefundPaymentOrder(singlePaymentOrder))
        .to.be.fulfilled
        .then(() => {
          expect(manualRefundMethod.callCount).to.be.equal(1);
          expect(_.map(manualRefundMethod.thisValues, m => m.get('id'))).to.be.deep.equal([19]);
        });
    });

    it('should reject the promise if one of the payments fails to manualRefund with other error than InvalidStateChangeError', () => {
      const error = new Error('Some error');
      manualRefundMethod.restore();
      manualRefundMethod = sinon.stub(Payment.prototype, 'manualRefunded', function () {
        if (this.get('id') == 16) {
          return reject(error);
        }

        return resolve();

      });

      return expect(paymentMethod.manualRefundPaymentOrder(paymentOrder))
        .to.be.rejected
        .then((errs) => {
          expect(errs).to.deep.equal(error);
          expect(manualRefundMethod.callCount).to.be.equal(3);
          expect(_.map(manualRefundMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });

    it('should reject with any of the errors if some of the payments fails to manualRefund with other error than InvalidStateChangeError', () => {
      const error16 = new Error('Some error');
      const error17 = new Error('Some other error');
      manualRefundMethod.restore();
      manualRefundMethod = sinon.stub(Payment.prototype, 'manualRefunded', function () {
        if (this.get('id') == 16) {
          return reject(error16);
        }
        if (this.get('id') == 17) {
          return reject(error17);
        }

        return resolve();

      });

      return expect(paymentMethod.manualRefundPaymentOrder(paymentOrder))
        .to.be.rejected
        .then((errs) => {
          expect(errs).to.deep.oneOf([error16, error17]);
          expect(manualRefundMethod.callCount).to.be.equal(3);
          expect(_.map(manualRefundMethod.thisValues, m => m.get('id'))).to.be.deep.equal([16, 17, 18]);
        });
    });
  });

  describe('#shouldRollbackPayments', () => {

    const testData = [
      // rejected
      {
        payments: [PaymentStatus.rejected, PaymentStatus.successful],
        paymentOrder: PaymentStatus.rejected,
        result: true,
      },
      {
        payments: [PaymentStatus.rejected, PaymentStatus.pendingAuthorize],
        paymentOrder: PaymentStatus.rejected,
        result: true,
      },
      {
        payments: [PaymentStatus.rejected, PaymentStatus.pendingCapture],
        paymentOrder: PaymentStatus.rejected,
        result: true,
      },
      {
        payments: [PaymentStatus.rejected, PaymentStatus.authorized],
        paymentOrder: PaymentStatus.rejected,
        result: true,
      },
      {
        payments: [PaymentStatus.rejected, PaymentStatus.rejected],
        paymentOrder: PaymentStatus.rejected,
        result: false,
      },
      {
        payments: [PaymentStatus.rejected],
        paymentOrder: PaymentStatus.rejected,
        result: false,
      },
      {
        payments: [PaymentStatus.rejected, PaymentStatus.successful],
        paymentOrder: PaymentStatus.rejected,
        result: true,
      },
      // cancelled
      {
        payments: [PaymentStatus.cancelled, PaymentStatus.successful],
        paymentOrder: PaymentStatus.cancelled,
        result: true,
      },
      {
        payments: [PaymentStatus.cancelled, PaymentStatus.pendingAuthorize],
        paymentOrder: PaymentStatus.cancelled,
        result: true,
      },
      {
        payments: [PaymentStatus.cancelled, PaymentStatus.pendingCapture],
        paymentOrder: PaymentStatus.cancelled,
        result: true,
      },
      {
        payments: [PaymentStatus.cancelled, PaymentStatus.authorized],
        paymentOrder: PaymentStatus.cancelled,
        result: true,
      },
      {
        payments: [PaymentStatus.cancelled, PaymentStatus.cancelled],
        paymentOrder: PaymentStatus.cancelled,
        result: false,
      },
      {
        payments: [PaymentStatus.cancelled],
        paymentOrder: PaymentStatus.cancelled,
        result: false,
      },
      {
        payments: [PaymentStatus.cancelled, PaymentStatus.successful],
        paymentOrder: PaymentStatus.cancelled,
        result: true,
      },
      // error
      {
        payments: [PaymentStatus.error, PaymentStatus.successful],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.error, PaymentStatus.pendingAuthorize],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.error, PaymentStatus.pendingCapture],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.error, PaymentStatus.authorized],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.error, PaymentStatus.error],
        paymentOrder: PaymentStatus.error,
        result: false,
      },
      {
        payments: [PaymentStatus.error],
        paymentOrder: PaymentStatus.error,
        result: false,
      },
      {
        payments: [PaymentStatus.error, PaymentStatus.successful],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.refunded, PaymentStatus.pendingAuthorize],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.refunded, PaymentStatus.pendingCapture],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.refunded, PaymentStatus.authorized],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.refunded, PaymentStatus.error],
        paymentOrder: PaymentStatus.error,
        result: false,
      },
      {
        payments: [PaymentStatus.refunded],
        paymentOrder: PaymentStatus.error,
        result: false,
      },
      {
        payments: [PaymentStatus.refunded, PaymentStatus.successful],
        paymentOrder: PaymentStatus.error,
        result: true,
      },
      {
        payments: [PaymentStatus.refunded, PaymentStatus.successful],
        paymentOrder: PaymentStatus.successful,
        result: false,
      },
      // mixes
      {
        payments: [PaymentStatus.error, PaymentStatus.cancelled],
        paymentOrder: PaymentStatus.error,
        result: false,
      },
      {
        payments: [PaymentStatus.error, PaymentStatus.cancelled],
        paymentOrder: PaymentStatus.error,
        result: false,
      },
      {
        payments: [PaymentStatus.chargedBack, PaymentStatus.successful],
        paymentOrder: PaymentStatus.chargedBack,
        result: false,
      },
      {
        payments: [PaymentStatus.successful, PaymentStatus.successful],
        paymentOrder: PaymentStatus.successful,
        result: false,
      },
      {
        payments: [PaymentStatus.successful, PaymentStatus.inMediation],
        paymentOrder: PaymentStatus.inMediation,
        result: false,
      },
      {
        payments: [PaymentStatus.inMediation, PaymentStatus.inMediation],
        paymentOrder: PaymentStatus.inMediation,
        result: false,
      },
    ];

    _.each(testData, (test) => {
      it(`should ${test.result ? '' : 'NOT '}rollback payment order if it status is ${test.paymentOrder} and the payments are [${test.payments.join(', ')}]`, () => {
        let paymentOrderTest;
        let inc = 100;

        const pPromises = _.map(test.payments, status =>
          knex('payments').insert({
            id: ++inc,
            type: 'creditCard',
            client_reference: `CR_${inc}`,
            status_id: status,
            payment_order_id: 50,
          }));

        const poPromise = knex('payment_orders')
          .insert({
            id: 50,
            payment_method_id: 1,
            currency: 'BRL',
            reference: 'REFERENCE',
            status_id: test.paymentOrder,
            buyer_id: 25,
            tenant_id: 1,
            total: 548,
          })
          .then(() => PaymentOrder.forge({ id: 50 }).fetch())
          .then(po => paymentOrderTest = po);

        pPromises.push(poPromise);

        return Promise.all(pPromises)
          .then(() =>
            expect(paymentMethod.shouldRollbackPayments(paymentOrderTest))
              .to.be.fulfilled
              .then(resp => expect(resp).to.be.equal(test.result, `The response of #shouldRollbackPayments should be ${test.result}`)));

      });
    });
  });

  describe('#validatePaymentsCreation', () => {
    const payment1 = {
      installments: 6,
      amountInCents: 60000,
      type: 'creditCard',
      paymentInformation: {
        processor: 'visa',
        lastFourDigits: 1234,
        firstSixDigits: 123456,
      },
      encryptedCreditCards: [{
        encryptedContent: '{{credit_card_token}}',
        encryptionType: 'mercadopagoToken',
      }],
    };
    const payment2 = {
      installments: 1,
      amountInCents: 1000,
      type: 'ticket',
      paymentInformation: {},
    };
    const onePaymentData = { some_id: payment1 };
    const twoPaymentData = { some_id: payment1, other_id: payment2 };
    const opts = {};

    it('should call its GatewayMethod and validate one payment', () => {
      gatewayMethod.validatePaymentCreation = sinon.stub().returns(resolve({}));
      paymentMethod.validatePayments = sinon.stub().returns(resolve({}));
      paymentMethod.selectGatewayMethods = sinon.stub().returns(resolve([gatewayMethod]));

      return expect(paymentMethod.validatePaymentsCreation(onePaymentData))
        .to.be.fulfilled
        .then(() => {
          expect(gatewayMethod.validatePaymentCreation.callCount).to.be.equal(1);
        });
    });

    it('should call its GatewayMethod and validate two payments', () => {
      gatewayMethod.validatePaymentCreation = sinon.stub().returns(resolve({}));
      paymentMethod.validatePayments = sinon.stub().returns(resolve({}));
      paymentMethod.selectGatewayMethods = sinon.stub().returns(resolve([gatewayMethod]));

      return expect(paymentMethod.validatePaymentsCreation(twoPaymentData))
        .to.be.fulfilled
        .then(() => {
          expect(gatewayMethod.validatePaymentCreation.callCount).to.be.equal(2);
        });
    });

    it('should fail if all its GatewayMethod.validatePaymentCreation fails (one payment)', () => {
      paymentMethod.validatePayments = sinon.stub().returns(resolve({}));
      paymentMethod.selectGatewayMethods = sinon.stub().returns(resolve([gatewayMethod]));

      const err = new Error('creation error');
      gatewayMethod.validatePaymentCreation = sinon.spy(() => reject(err));

      return expect(paymentMethod.validatePaymentsCreation(onePaymentData, opts))
        .to.be.rejectedWith(err);
    });

    it('should fail if all its GatewayMethod.validatePaymentCreation fails (two payments)', () => {
      paymentMethod.validatePayments = sinon.stub().returns(resolve({}));
      paymentMethod.selectGatewayMethods = sinon.stub().returns(resolve([gatewayMethod]));

      const err = new Error('creation error');
      gatewayMethod.validatePaymentCreation = sinon.spy(() => reject(err));

      return expect(paymentMethod.validatePaymentsCreation(twoPaymentData, opts))
        .to.be.rejectedWith(err);
    });

    it('should fail if its selectGatewayMethods fails', () => {
      const err = new Error('DB error');
      paymentMethod.validatePayments = sinon.stub().returns(resolve({}));
      paymentMethod.selectGatewayMethods = () => reject(err);

      return expect(paymentMethod.validatePaymentsCreation(twoPaymentData, opts))
        .to.be.rejectedWith(err);
    });

    it('should fail if its PaymentMethod.validatePayments fails', () => {
      const err = new Error('Validation error');
      paymentMethod.validatePayments = sinon.stub().returns(reject(err));
      paymentMethod.selectGatewayMethods = sinon.stub().returns(resolve([gatewayMethod]));

      return expect(paymentMethod.validatePaymentsCreation(twoPaymentData, opts))
        .to.be.rejectedWith(err);
    });

  });

  describe('#update', () => {
    it('should update the enabled column from a payment method', () => {
      return expect(paymentMethod.update({ enabled: false }))
        .to.be.fulfilled
        .then((pm) => {
          expect(pm.get('enabled')).to.be.false;

          return pm;
        })
        .then(pm => pm.refresh())
        .then(pm => expect(!!pm.get('enabled')).to.be.false);
    });

    it('should update the gateway_method_id column from a payment method', () => {
      return expect(paymentMethod.update({ gateway_method_id: 2 }))

        .to.be.fulfilled
        .then((pm) => {
          expect(pm.get('gateway_method_id')).to.be.equal(2);
          return pm;
        })
        .then(pm => pm.refresh())
        .then(pm => expect(pm.get('gateway_method_id')).to.be.equal(2));
    });

    it('should return a promise if it has nothing update', () => {
      return expect(paymentMethod.update({ lala: 2 }))
        .to.be.fulfilled
        .then(pm => expect(pm).to.be.equal(paymentMethod));
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
