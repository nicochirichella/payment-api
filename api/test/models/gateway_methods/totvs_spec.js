'use strict';

const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const Payment = require('../../../src/models/payment.js');
const GatewayMethod = require('../../../src/models/gateway_method.js');
const PaymentStatus = require('../../../src/models/constants/payment_status.js');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const Gateway = require('../../../src/models/gateway.js');
const Promise = require('bluebird');
const errors = require('../../../src/errors');
const knex = require('../../../src/bookshelf').knex;

describe('#Gateway Methods :: Totvs', () => {
  let payment,
    totvs,
    gateway;

  beforeEach(() => {
    totvs = new GatewayMethod();
    _.extend(totvs, require('../../../src/models/gateway_methods/totvs'));

    gateway = new Gateway();
    _.extend(gateway, require('../../../src/models/gateways/totvs'));

    totvs.gateway = gateway;

    payment = new Payment({
      currency: 'CUR',
      amount: 34.20,
      client_reference: '0123-payment-ref',
      status_id: 'pending',
      gateway_method_id: 1,
      type: 'totvs',
      tenant_id: 1,
      status_detail: PaymentStatusDetail.unknown,
    });

  });

  describe.skip('#capturePayment', () => {});

  describe('#validatePayment', () => {
    it('should validate that the payment type does correct', () => {
      return expect(totvs.validatePayment({
        type: 'totvs',
      }))
        .to.be.successful;
    });

    it('should reject if the payment does not correct type', () => {
      return expect(totvs.validatePayment({
        type: 'creditCard',
      }))
        .to.be.rejectedWith(errors.BadRequest, 'Wrong payment type: creditCard. Expected totvs');
    });
  });

  describe('#cancelPayment', () => {
    it('should be error because is not implemented', () => {
      return expect(totvs.cancelPayment()).to.be.rejectedWith(Error, 'Not implemented');
    });
  });

  describe('#executePayment', () => {
    it('should be error because is not implemented', () => {
      return expect(totvs.executePayment()).to.be.rejectedWith(Error, 'Not implemented');
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

