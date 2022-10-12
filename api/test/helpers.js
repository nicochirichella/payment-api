'use strict';

const knex = require('../src/bookshelf').knex;
const Payment = require('../src/models/payment');
const PaymentOrder = require('../src/models/payment_order');
const Item = require('../src/models/item');
const sinon = require('sinon');
const Promise = require('bluebird');
const PaymentStatusDetail = require('../src/models/constants/payment_status_detail');
const _ = require('lodash');

module.exports = {

  compressXML: (xmlString) => {
    return xmlString.replace(/(\r\n\t|\n|\r\t)/gm, '').replace(/>\s+</g, '><');
  },
  createPaymentMock(paymentMetadata, paymentOrderMetadata) {

    const buyerPromise = knex('buyers')
      .insert({
        id: 21,
        external_reference: '12345',
        type: 'person',
        phone: '1234567890',
        document_number: '000111222333',
        document_type: 'CPF',
        email: 'test@test.com',
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
      });

    const paymentOrderPromise = knex('payment_orders')
      .insert({
        id: 1,
        buyer_id: 21,
        purchase_reference: 'PURCHASE_REFERENCE',
        metadata: paymentOrderMetadata,
        tenant_id: 1,
        total: 400.52,
      });

    const itemPromise = knex('items')
      .insert({
        id: 1,
        payment_order_id: 1,
        name: 'Samsung Galaxy Mega Duos Preto (Bom)',
        external_reference: '4499',
        discount: 10,
        total: 34.20,
        unit_cost: 34.20,
        quantity: 1,
        image_url: 'www.trocafone.com/image',
      });

    const paymentPromise = knex('payments')
      .insert({
        id: 11,
        payment_order_id: 1,
        currency: 'CUR',
        status_detail: PaymentStatusDetail.ok,
        amount: 34.20,
        type: 'creditCard',
        installments: 8,
        interest: 8.03,
        payment_information: '{"processor": "visa", "holderDocumentNumber": "35111931"}',
        client_reference: '0123-payment-ref',
        gateway_reference: 'mpMockId',
        metadata: paymentMetadata,
        tenant_id: 1,
      });

    return Promise.all([paymentPromise, buyerPromise, paymentOrderPromise, itemPromise])
      .then((results) => {
        return Promise.all([
            Payment.forge({id: 11}).fetch(),
            PaymentOrder.forge({id: 1}).fetch(),
        ])
          .then((results) => {
            {

              const payment = results[0];
              const paymentOrder = results[1];

              let modelGet = payment.get;

              let paymentOrderGet = paymentOrder.get;
              sinon.stub(paymentOrder, 'get', (key) => {
                if (key === 'metadata') {
                  return paymentOrderMetadata;
                } else {
                  return paymentOrderGet.apply(paymentOrder, [key]);
                }
              });

              sinon.stub(payment, 'get', function (key) {

                if (key === 'payment_information') {
                  const value = this.attributes[key];
                  return JSON.parse(value);
                }

                if (key === 'metadata') {
                  return paymentMetadata;
                }

                return modelGet.apply(this, arguments);
              });

              const modelGetRelation = payment.getRelation;
              sinon.stub(payment, 'getRelation', function (key) {
                if (key === 'paymentOrder') {
                  return Promise.resolve(paymentOrder);
                }

                return modelGetRelation.apply(this, arguments);
              });
              return payment;
            }
          });
      });
  },
};
