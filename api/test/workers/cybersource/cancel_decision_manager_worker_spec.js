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
const CancelDecisionManagerWorker = require('../../../src/workers/cybersource/cancel_decision_manager_worker');

describe('Cancel Decision Manager Worker Spec', function () {


  describe('#repeatableAction', () => {

    let cancelDecisionManagerWorker;

    beforeEach(() => {
      cancelDecisionManagerWorker = new CancelDecisionManagerWorker(1, { dmRequestId: "123" });
    });

    it('should call the gatewayMethod authorizationReversePayment method', () => {

      const cancelManualRevisionPaymentStub = sinon.stub().returns(Promise.resolve());
      cancelDecisionManagerWorker.gatewayMethod = {
        cancelManualRevisionPayment: cancelManualRevisionPaymentStub,
      };
      return expect(cancelDecisionManagerWorker.repeatableAction()).to.be.fulfilled.then(() => {
        return expect(cancelManualRevisionPaymentStub.called).to.eql(true);
      });

    });

  });
});
