'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const Promise = require('bluebird');
const _ = require('lodash');
const knex = require('../../src/bookshelf').knex;
const Payment = require('../../src/models/payment');
const PaymentMethod = require('../../src/models/payment_method');
const PaymentOrder = require('../../src/models/payment_order');
const PaymentStatus = require('../../src/models/constants/payment_status');
const queueService = require('../../src/services/queue_service');
const errors = require('../../src/errors');

describe('PaymentOrder Model', function () {
  let paymentMethod;

  describe('#create', () => {
    beforeEach(() => {
      return knex('payment_methods')
        .insert({
          id: 1,
          tenant_id: 1,
          type: 'ONE_CREDIT_CARD',
          name: 'MethodA',
          enabled: true,
        })
        .then(() => PaymentMethod.forge({ id: 1 }).fetch())
        .then((pm) => {
          paymentMethod = pm;
        });
    });

    it('should create a PaymentOrder with one Payment', () => {
      const data = _.clone(require('../fixtures/paymentCreationRequest/payment_order_single_payment.json'), true);
      paymentMethod.validatePaymentsCreation = sinon.spy(data => resolve({}));
      return expect(PaymentOrder.create(paymentMethod, data.paymentOrder))
        .to.be.fulfilled
        .then((paymentOrder) => {
          const paymentMethod = paymentOrder.related('paymentMethod');
          const items = paymentOrder.related('items');
          const buyer = paymentOrder.related('buyer');
          const payments = paymentOrder.getRelation('validPayments');

          // paymentOrder check
          expect(paymentOrder.get('status_id')).to.be.equal(PaymentStatus.creating);
          expect(paymentOrder.get('purchase_reference')).to.be.equal('PURCHASE_REFERENCE');
          expect(paymentOrder.get('reference')).to.be.equal('PAYMENT_API_REFERENCE');
          expect(paymentOrder.get('currency')).to.be.equal('BRL');
          expect(paymentOrder.get('total')).to.be.equal(1100);
          expect(paymentOrder.get('interest')).to.be.equal(100);

          // Payment Method check
          expect(paymentMethod.get('id')).to.be.equal(1);
          expect(paymentMethod.get('type')).to.be.equal('ONE_CREDIT_CARD');

          // Items check
          expect(items.length).to.be.equal(1);
          expect(items.first().get('name')).to.be.equal('Nome do Produto de Teste');
          expect(items.first().get('total')).to.be.equal(1000.00);

          // Buyer check
          expect(buyer.get('name')).to.be.equal('Alexandre B.');
          expect(buyer.get('birth_date')).to.be.equal('1995-01-31');
          expect(buyer.get('billing_city')).to.be.equal('BRio de Janeiro');
          expect(buyer.get('shipping_district')).to.be.equal('SCentro');

          expect(paymentMethod.validatePaymentsCreation.callCount).to.be.equal(1);
        });
    });

    it('should create a PaymentOrder with several Payments', () => {
      const data = _.clone(require('../fixtures/paymentCreationRequest/payment_order_three_payments.json'), true);
      paymentMethod.validatePaymentsCreation = sinon.spy(data => resolve({}));

      return expect(PaymentOrder.create(paymentMethod, data.paymentOrder))
        .to.be.fulfilled
        .then((paymentOrder) => {
          const paymentMethod = paymentOrder.related('paymentMethod');
          const items = paymentOrder.related('items');
          const buyer = paymentOrder.related('buyer');
          const payments = paymentOrder.getRelation('validPayments');

          // paymentOrder check
          expect(paymentOrder.get('status_id')).to.be.equal(PaymentStatus.creating);
          expect(paymentOrder.get('purchase_reference')).to.be.equal('PURCHASE_REFERENCE');
          expect(paymentOrder.get('reference')).to.be.equal('PAYMENT_API_REFERENCE');
          expect(paymentOrder.get('currency')).to.be.equal('BRL');
          expect(paymentOrder.get('total')).to.be.equal(1100);
          expect(paymentOrder.get('interest')).to.be.equal(100);

          // Payment Method check
          expect(paymentMethod.get('id')).to.be.equal(1);
          expect(paymentMethod.get('type')).to.be.equal('ONE_CREDIT_CARD');

          // Items check
          expect(items.length).to.be.equal(1);
          expect(items.first().get('name')).to.be.equal('Nome do Produto de Teste');
          expect(items.first().get('total')).to.be.equal(1000.00);

          // Buyer check
          expect(buyer.get('name')).to.be.equal('Alexandre B.');
          expect(buyer.get('birth_date')).to.be.equal('1995-01-31');
          expect(buyer.get('billing_city')).to.be.equal('BRio de Janeiro');
          expect(buyer.get('shipping_district')).to.be.equal('SCentro');

          expect(paymentMethod.validatePaymentsCreation.callCount).to.be.equal(1);
        });
    });

    it('should fail if createPayment fails', () => {
      const data = _.clone(require('../fixtures/paymentCreationRequest/payment_order_single_payment.json'), true);
      paymentMethod.validatePaymentsCreation = sinon.spy(() => reject({}));

      return expect(PaymentOrder.create(paymentMethod, data.paymentOrder))
        .to.be.rejected;
    });
  });

  describe('#execute', function () {
    beforeEach(() => {
      const pm = knex('payment_methods')
        .insert({
          id: 1,
          tenant_id: 1,
          type: 'PAYPAL',
          name: 'MethodA',
          enabled: true,
        })
        .then(() => PaymentMethod.forge({ id: 1 }).fetch())
        .then((pm) => {
          this.paymentMethod = pm;
        });

      const po = knex('payment_orders').insert({
        id: 20,
        currency: 'BRL',
        purchase_reference: 'PR_20',
        reference: 'R_20',
        payment_method_id: 1,
        buyer_id: 1,
        tenant_id: 1,
        status_id: PaymentStatus.pendingClientAction,
        total: 200,
        interest: 20,
        metadata: {
          pendingUrl: 'www.pending.com',
          successUrl: 'www.success.com',
          cancelUrl: 'www.cancel.com',
          delivery: {
             "type": "normal",
             "estimated_time": 6
          }
        },
      })
        .then(() => PaymentOrder.forge({ id: 20 }).fetch())
        .then((po) => {
          this.paymentOrder = po;
        });

      const p = knex('payments').insert([
        {
          id: 1,
          currency: 'CUR',
          amount: 34.20,
          interest: 3.42,
          type: 'creditCard',
          status_id: PaymentStatus.pendingClientAction,
          gateway_method_id: 1,
          tenant_id: 1,
          payment_order_id: 20,
          client_reference: 'CLIENT_REFERENCE_1',
          status_detail: 'unknown',
          expiration_date: new Date(),
        },
      ])
        .then(() => Payment.forge({ id: 1 }).fetch())
        .then((p) => {
          this.payment = p;
        });

      return Promise.all([pm, po]);
    });

    it('should call executePaymentOrder of the payment method when called to execute', () => {
      this.paymentMethod.executePaymentOrder = sinon.spy(() => this.payment.save({ status_id: PaymentStatus.successful }));
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;

      return expect(this.paymentOrder.execute()).to.be.fulfilled
        .then(() => {
          expect(this.paymentMethod.executePaymentOrder.callCount).to.be.equal(1);
          expect(this.paymentOrder.get('status_id')).to.be.equal(PaymentStatus.successful);
        });
    });

    it('should return a rejected promise if payment method is rejected with an error', () => {
      const error = new Error('Something wrong just happened');
      this.paymentMethod.executePaymentOrder = sinon.spy(() => reject(error));
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;

      return expect(this.paymentOrder.execute()).to.be.rejectedWith(error)
        .then(() => {
          expect(this.paymentMethod.executePaymentOrder.callCount).to.be.equal(1);
          expect(this.paymentOrder.get('status_id')).to.be.equal(PaymentStatus.pendingClientAction);
        });
    });

    it('should return a rejected promise if pm.executePaymentOrder but it is asked to make an invalid transition', () => {

      this.paymentMethod.executePaymentOrder = sinon.spy(() => Promise.resolve());
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;

      return this.paymentOrder.set('status_id', PaymentStatus.successful)
        .save()
        .then(() => {
          expect(this.paymentOrder.execute()).to.be.rejected;
        });
    });

  });

  describe('#cancel', function () {
    beforeEach(() => {
      const pm = knex('payment_methods')
        .insert({
          id: 1,
          tenant_id: 1,
          type: 'PAYPAL',
          name: 'MethodA',
          enabled: true,
        })
        .then(() => PaymentMethod.forge({ id: 1 }).fetch())
        .then((pm) => {
          this.paymentMethod = pm;
        });

      const po = knex('payment_orders').insert({
        id: 20,
        currency: 'BRL',
        purchase_reference: 'PR_20',
        reference: 'R_20',
        payment_method_id: 1,
        buyer_id: 1,
        tenant_id: 1,
        status_id: PaymentStatus.pendingClientAction,
        total: 200,
        interest: 20,
        metadata: {
          pendingUrl: 'www.pending.com',
          successUrl: 'www.success.com',
          cancelUrl: 'www.cancel.com',
          delivery: {
              "type": "normal",
              "estimated_time": 6
          },
        },
      })
        .then(() => PaymentOrder.forge({ id: 20 }).fetch())
        .then((po) => {
          this.paymentOrder = po;
        });

      const p = knex('payments').insert([
        {
          id: 1,
          currency: 'CUR',
          amount: 34.20,
          interest: 3.42,
          type: 'creditCard',
          status_id: PaymentStatus.pendingClientAction,
          gateway_method_id: 1,
          tenant_id: 1,
          payment_order_id: 20,
          client_reference: 'CLIENT_REFERENCE_1',
          status_detail: 'unknown',
          expiration_date: new Date(),
        },
      ])
        .then(() => Payment.forge({ id: 1 }).fetch())
        .then((p) => {
          this.payment = p;
        });

      return Promise.all([pm, po]);
    });

    it('should call cancelPaymentOrder and updateStatus of the payment method when called to execute', () => {
      this.paymentMethod.cancelPaymentOrder = sinon.spy(() => this.payment.save({ status_id: PaymentStatus.cancelled }));
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;


      return expect(this.paymentOrder.cancel()).to.be.fulfilled
        .then(() => {
          expect(this.paymentMethod.cancelPaymentOrder.callCount).to.be.equal(1);
          expect(this.paymentOrder.get('status_id')).to.be.equal(PaymentStatus.cancelled);
        });
    });

    it('should return a rejected promise if payment method is rejected with an error and rollback status', () => {
      const error = new Error('Something wrong just happened');
      this.paymentMethod.cancelPaymentOrder = sinon.spy(() => reject(error));
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;

      return expect(this.paymentOrder.cancel()).to.be.rejectedWith(error)
        .then(() => {
          expect(this.paymentMethod.cancelPaymentOrder.callCount).to.be.equal(1);
          expect(this.paymentOrder.get('status_id')).to.be.equal(PaymentStatus.pendingClientAction);
        });
    });

  });


  describe('#getExpirationDate', () => {

    let paymentOrder;

    beforeEach(() => {
      const po = knex('payment_orders').insert({
        id: 20,
        currency: 'BRL',
        purchase_reference: 'PR_20',
        reference: 'R_20',
        payment_method_id: 1,
        buyer_id: 1,
        tenant_id: 1,
        status_id: PaymentStatus.pendingCapture,
        total: 200,
        interest: 20,
      });

      const p = knex('payments').insert([
        { id: 1, payment_order_id: 20, expiration_date: '2020-03-16T18:47:03Z' },
        { id: 2, payment_order_id: 20, expiration_date: '2017-03-16T18:47:03Z' },
      ]);

      return Promise.all([po, p])
        .then(() => PaymentOrder.forge({ id: 20 }).fetch())
        .then((po) => {
          paymentOrder = po;
        });

    });

    it('should return null if there is at least one payment with null expiration date', () => {
      return knex('payments').update({ expiration_date: null }).where('id', 1).then(() => {
        return paymentOrder.getExpirationDate().then((expDate) => {
          expect(expDate).to.equal(null);
        });
      });
    });

    it('should return the greatest (most ahead in the future) expiration date if there is no payments with null expiration_date', () => {
      return paymentOrder.getExpirationDate().then((expDate) => {
        expect(expDate).to.equal(Date.parse('2020-03-16T18:47:03Z'));
      });
    });

  });

  describe('#updateStatus', () => {
    beforeEach(() => {
      const po = knex('payment_orders').insert({
        id: 20,
        currency: 'BRL',
        purchase_reference: 'PR_20',
        reference: 'R_20',
        payment_method_id: 1,
        buyer_id: 1,
        tenant_id: 1,
        status_id: PaymentStatus.pendingCapture,
        total: 200,
        interest: 20,
      });

      const pm = knex('payment_methods').insert({
        id: 1,
        tenant_id: 1,
        type: 'ONE_CREDIT_CARD',
        name: 'MethodA',
        enabled: true,
      });

      return Promise.all([po, pm])
        .then(() => PaymentMethod.forge({ id: 1 }).fetch())
        .then((pm) => {
          this.paymentMethod = pm;
        })
        .then(() => PaymentOrder.forge({ id: 20 }).fetch())
        .then((po) => {
          this.paymentOrder = po;
        });
    });

    it('should update the payment order status if the payment method calculates a new one', () => {
      this.paymentMethod.calculateStatus = sinon.spy(() => PaymentStatus.successful);
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;

      return expect(this.paymentOrder.updateStatus())
        .to.eventually.deep.equal({
          oldStatus: PaymentStatus.pendingCapture,
          newStatus: PaymentStatus.successful,
        })
        .then(() => {
          expect(this.paymentOrder.get('status_id')).to.be.equal(PaymentStatus.successful);
        });
    });

    it('should maintain the same status if the payment method calculate the same', () => {
      this.paymentMethod.calculateStatus = sinon.spy(() => PaymentStatus.pendingCapture);
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;

      return expect(this.paymentOrder.updateStatus())
        .to.eventually.deep.equal({
          oldStatus: PaymentStatus.pendingCapture,
          newStatus: PaymentStatus.pendingCapture,
        })
        .then(() => {
          expect(this.paymentOrder.get('status_id')).to.be.equal(PaymentStatus.pendingCapture);
        });
    });

    it('should maintain the same status if the transition is an ignorable transition', () => {
      this.paymentMethod.calculateStatus = sinon.spy(() => PaymentStatus.pendingAuthorize);
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;

      this.paymentOrder.get = sinon.stub().withArgs('status_id').returns(PaymentStatus.pendingCancel);

      return expect(this.paymentOrder.updateStatus())
        .to.eventually.deep.equal({
          oldStatus: PaymentStatus.pendingCancel,
          newStatus: PaymentStatus.pendingAuthorize,
        })
        .then(() => {
          expect(this.paymentOrder.get('status_id')).to.be.equal(PaymentStatus.pendingCancel);
        });
    });

    it('should change the status although it is not valid to transition', () => {
      this.paymentMethod.calculateStatus = sinon.spy(() => PaymentStatus.creating);
      this.paymentOrder.relations.paymentMethod = this.paymentMethod;

      return expect(this.paymentOrder.updateStatus())
        .to.eventually.deep.equal({
          oldStatus: PaymentStatus.pendingCapture,
          newStatus: PaymentStatus.creating,
        })
        .then(() => {
          expect(this.paymentOrder.get('status_id')).to.be.equal(PaymentStatus.creating);
        });
    });
  });


  describe('#notifyToTenant', () => {
    let queueService;
    let queueStub;
    let singlePaymentOrder;
    let multiPaymentOrderWithDifferentGM;
    let multiPaymentOrderWithSameGM;

    beforeEach(async () => {
      queueService = require('../../src/services/queue_service');
      queueStub = sinon.stub(queueService, 'sendIpn').returns(Promise.resolve());

      await knex('gateway_methods')
        .insert([{
          id: 1,
          tenant_id: 1,
          type: 'MERCADOPAGO_CC',
          name: 'MethodA',
          enabled: true,
          payment_method_id: 1,
          syncronic_notify_on_creation: true,
        },
        {
          id: 2,
          tenant_id: 1,
          type: 'MERCADOPAGO_CC',
          name: 'MethodB',
          enabled: true,
          payment_method_id: 1,
          syncronic_notify_on_creation: true,
        }]);

      await knex('payments')
        .insert([{
          id: 19,
          client_reference: 'CR_19',
          status_id: PaymentStatus.successful,
          payment_order_id: 30,
          gateway_method_id: 1,
        },
        {
          id: 20,
          client_reference: 'CR_20',
          status_id: PaymentStatus.successful,
          payment_order_id: 31,
          gateway_method_id: 1,
        },
        {
          id: 21,
          client_reference: 'CR_21',
          status_id: PaymentStatus.successful,
          payment_order_id: 31,
          gateway_method_id: 2,
        },
        {
          id: 22,
          client_reference: 'CR_22',
          status_id: PaymentStatus.successful,
          payment_order_id: 32,
          gateway_method_id: 1,
        },
        {
          id: 23,
          client_reference: 'CR_23',
          status_id: PaymentStatus.successful,
          payment_order_id: 32,
          gateway_method_id: 1,
        }]);

      await knex('payment_orders')
        .insert([{
          id: 30,
          payment_method_id: 1,
          currency: 'BRL',
          reference: 'REFERENCE_30',
          buyer_id: 25,
          tenant_id: 1,
          total: 548,
          interest: 54.8,
        },
        {
          id: 31,
          payment_method_id: 1,
          currency: 'BRL',
          reference: 'REFERENCE_31',
          buyer_id: 26,
          tenant_id: 1,
          total: 548,
          interest: 54.8,
        },
        {
          id: 32,
          payment_method_id: 1,
          currency: 'BRL',
          reference: 'REFERENCE_32',
          buyer_id: 27,
          tenant_id: 1,
          total: 548,
          interest: 54.8,
        }])
        .then(async () => {
          singlePaymentOrder = await PaymentOrder.forge({ id: 30 }).fetch();
          multiPaymentOrderWithDifferentGM = await PaymentOrder.forge({ id: 31 }).fetch();
          multiPaymentOrderWithSameGM = await PaymentOrder.forge({ id: 32 }).fetch();
        });
    });

    afterEach(() => {
      queueStub.restore();
    });

    it('should send an IPN if the gateway method has the sycncronic notify property in true', () => {
      return expect(singlePaymentOrder.notifyToTenant())
        .to.be.fulfilled
        .then(() => {
          expect(queueStub.callCount).to.be.equal(1);
        });
    });

    it('should not send an IPN if the gateway method has the sycncronic notify property in false', async () => {
      await knex('gateway_methods').update({syncronic_notify_on_creation: false});

      return expect(singlePaymentOrder.notifyToTenant())
        .to.be.fulfilled
        .then(() => {
          expect(queueStub.callCount).to.be.equal(0);
        });
      });

    it('should send an IPN if all the gateway methods (different ones) has the sycncronic notify property in true', async () => {
      return expect(multiPaymentOrderWithDifferentGM.notifyToTenant())
        .to.be.fulfilled
        .then(() => {
          expect(queueStub.callCount).to.be.equal(1);
        });
    });

    it('should send an IPN if all the gateway methods (same ones) has the sycncronic notify property in true', async () => {
      return expect(multiPaymentOrderWithSameGM.notifyToTenant())
        .to.be.fulfilled
        .then(() => {
          expect(queueStub.callCount).to.be.equal(1);
        });
    });

    it('should send an IPN if some the payment method (different ones) has the sycncronic notify property in false', async () => {
      await knex('gateway_methods').where('id', 2).update({syncronic_notify_on_creation: false});

      return expect(multiPaymentOrderWithDifferentGM.notifyToTenant())
        .to.be.fulfilled
        .then(() => {
          expect(queueStub.callCount).to.be.equal(1);
        });
    });

    it('should not send an IPN if all the payment method (same ones) has the sycncronic notify property in false', async () => {
      await knex('gateway_methods').where('id', 1).update({syncronic_notify_on_creation: false});

      return expect(multiPaymentOrderWithSameGM.notifyToTenant())
        .to.be.fulfilled
        .then(() => {
          expect(queueStub.callCount).to.be.equal(0);
        });
    });

    it('should not send an IPN if all the payment method (different ones) has the sycncronic notify property in false', async () => {
      await knex('gateway_methods').update({syncronic_notify_on_creation: false});

      return expect(multiPaymentOrderWithDifferentGM.notifyToTenant())
        .to.be.fulfilled
        .then(() => {
          expect(queueStub.callCount).to.be.equal(0);
        });
    });
  });


  describe('#capture', () => {
    beforeEach(() => {
      this.queueCapturePayment = sinon.stub(queueService, 'capturePayment', () => resolve());
    });

    beforeEach(() => {

      const po = knex('payment_orders').insert([
        {
          id: 10,
          currency: 'BRL',
          purchase_reference: 'PR_20',
          reference: 'R_20',
          payment_method_id: 1,
          buyer_id: 1,
          tenant_id: 1,
          status_id: PaymentStatus.authorized,
          total: 200,
          interest: 20,
        },
        {
          id: 20,
          currency: 'BRL',
          purchase_reference: 'PR_20',
          reference: 'R_20',
          payment_method_id: 1,
          buyer_id: 1,
          tenant_id: 1,
          status_id: PaymentStatus.authorized,
          total: 200,
          interest: 20,
        },
        {
          id: 30,
          currency: 'BRL',
          purchase_reference: 'PR_20',
          reference: 'R_20',
          payment_method_id: 1,
          buyer_id: 1,
          tenant_id: 1,
          status_id: PaymentStatus.authorized,
          total: 200,
          interest: 20,
        },
        {
          id: 40,
          currency: 'BRL',
          purchase_reference: 'PR_20',
          reference: 'R_20',
          payment_method_id: 1,
          buyer_id: 1,
          tenant_id: 1,
          status_id: PaymentStatus.successful,
          total: 200,
          interest: 20,
        },
      ]);

      const p = knex('payments').insert([
        { id: 1, payment_order_id: 20 },
        { id: 2, payment_order_id: 30 },
        { id: 3, payment_order_id: 30 },
        { id: 4, payment_order_id: 30 },
      ]);

      return Promise.all([po, p])
        .then(() => PaymentOrder.forge({ id: 20 }).fetch())
        .then((po) => {
          this.paymentOrder = po;
        });
    });

    afterEach(() => {
      this.queueCapturePayment.restore();
    });

    it('should return a fulfilled promise without calling queueService', () => {
      return PaymentOrder.forge({ id: 10 })
        .fetch()
        .then((po) => {
          return expect(po.capture()).to.be.fulfilled
            .then(() => {
              expect(this.queueCapturePayment.callCount).to.be.equal(0);
              expect(po.get('status_id')).to.be.equal(PaymentStatus.pendingCapture);
            });
        });
    });

    it('should call queueService#capturePayment with the only payment that the order has', () => {
      return PaymentOrder.forge({ id: 20 })
        .fetch()
        .then((po) => {
          return expect(po.capture()).to.be.fulfilled
            .then(() => {
              expect(this.queueCapturePayment.firstCall.args[0].get('id')).to.be.equal(1);
              expect(this.queueCapturePayment.callCount).to.be.equal(1);
              expect(po.get('status_id')).to.be.equal(PaymentStatus.pendingCapture);
            });
        });
    });

    it('should call queueService#capturePayment with each payment that the order has', () => {
      return PaymentOrder.forge({ id: 30 })
        .fetch()
        .then((po) => {
          return expect(po.capture()).to.be.fulfilled
            .then(() => {
              expect(this.queueCapturePayment.firstCall.args[0].get('id')).to.be.equal(2);
              expect(this.queueCapturePayment.secondCall.args[0].get('id')).to.be.equal(3);
              expect(this.queueCapturePayment.thirdCall.args[0].get('id')).to.be.equal(4);
              expect(this.queueCapturePayment.callCount).to.be.equal(3);
              expect(po.get('status_id')).to.be.equal(PaymentStatus.pendingCapture);
            });
        });
    });

    it('should try to capture all the payment and return a rejected promise if one payment fails to queue the capture', () => {
      const error = new Error('Some random error occurred');

      this.queueCapturePayment.restore();

      let count = 0;
      this.queueCapturePayment = sinon.stub(queueService, 'capturePayment', () => {
        count++;
        if (count == 2) {
          return reject(error);
        }
        return resolve();
      });

      return PaymentOrder.forge({ id: 30 })
        .fetch()
        .then((po) => {
          return expect(po.capture()).to.be.rejectedWith(error)
            .then(() => {
              expect(this.queueCapturePayment.firstCall.args[0].get('id')).to.be.equal(2);
              expect(this.queueCapturePayment.secondCall.args[0].get('id')).to.be.equal(3);
              expect(this.queueCapturePayment.thirdCall.args[0].get('id')).to.be.equal(4);
              expect(this.queueCapturePayment.callCount).to.be.equal(3);
              expect(po.get('status_id')).to.be.equal(PaymentStatus.authorized);
            });
        });
    });

    it('should try to capture all the payment and return a rejected promise with one of the errors if all of them fails to queue the capture ', () => {
      const errors = [
        new Error('Some random error occurred with payment 1'),
        new Error('Some random error occurred with payment 2'),
        new Error('Some random error occurred with payment 3'),
      ];

      this.queueCapturePayment.restore();

      let count = 0;
      this.queueCapturePayment = sinon.stub(queueService, 'capturePayment', () => {
        const rej = reject(errors[count]);
        count++;
        return rej;
      });

      return PaymentOrder.forge({ id: 30 })
        .fetch()
        .then((po) => {
          return expect(po.capture()).to.be.rejected
            .to.eventually.be.oneOf(errors)
            .then(() => {
              expect(this.queueCapturePayment.firstCall.args[0].get('id')).to.be.equal(2);
              expect(this.queueCapturePayment.secondCall.args[0].get('id')).to.be.equal(3);
              expect(this.queueCapturePayment.thirdCall.args[0].get('id')).to.be.equal(4);
              expect(this.queueCapturePayment.firstCall.returnValue).to.be.rejectedWith(errors[0]);
              expect(this.queueCapturePayment.secondCall.returnValue).to.be.rejectedWith(errors[1]);
              expect(this.queueCapturePayment.thirdCall.returnValue).to.be.rejectedWith(errors[2]);
              expect(this.queueCapturePayment.callCount).to.be.equal(3);
              expect(po.get('status_id')).to.be.equal(PaymentStatus.authorized);
            });
        });
    });

    it('should return an InvalidStateChangeError if the payment order is not in a status available to capture', () => {
      return PaymentOrder.forge({ id: 40 })
        .fetch()
        .then((po) => {
          return expect(po.capture())
            .to.be.rejectedWith(errors.InvalidStateChangeError)
            .then(() => {
              expect(this.queueCapturePayment.callCount).to.be.equal(0);
              expect(po.get('status_id')).to.be.equal(PaymentStatus.successful);
            });
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

