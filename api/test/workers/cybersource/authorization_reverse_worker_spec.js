'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const _ = require('lodash');
const knex = require('../../../src/bookshelf').knex;
const GatewayMethod = require('../../../src/models/gateway_method');
const CybersourceCC = require('../../../src/models/gateway_methods/cybersource_cc');
const Payment = require('../../../src/models/payment');
const PaymentStatus = require('../../../src/models/constants/payment_status');
const PaymentStatusDetail = require('../../../src/models/constants/payment_status_detail');
const AuthorizationReverseWorker = require('../../../src/workers/cybersource/authorization_reverse_worker');

describe('Authorization Reverse Worker Spec', function () {


  describe('#constructor', () => {

    it('should correctly set the dmRequestId attribute', () => {
      const dmRequestId = "EXAMPLE";
      const authorizationReverseWorker = new AuthorizationReverseWorker(1, {dmRequestId});
      expect(authorizationReverseWorker.data).to.eql({dmRequestId});
    });
  });


  describe('#repeatableAction', () => {

    let authorizationReverseWorker;

    beforeEach(() => {
      authorizationReverseWorker = new AuthorizationReverseWorker(1);
    });

    it('should call the gatewayMethod authorizationReversePayment method', () => {

      const authorizationReversePaymentStub = sinon.stub().returns(Promise.resolve());
      authorizationReverseWorker.gatewayMethod = {
        authorizationReversePayment: authorizationReversePaymentStub
      };
      return expect(authorizationReverseWorker.repeatableAction()).to.be.fulfilled.then(() => {
        return expect(authorizationReversePaymentStub.called).to.eql(true);
      });

    });

  });
});
