'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;
const mockery = require('mockery');
const _ = require('lodash');
const nock = require('nock');
const PaymentOrder = require('../../src/models/payment_order');

describe('IPN Send service', () => {

  describe('#ipnSend', () => {
    beforeEach(function () {
      this.paymentOrder = new PaymentOrder({
        currency: 'CUR',
        total: 34.20,
        reference: '0123-payment-ref',
        status_id: 'pending',
        payment_method_id: 1,
        buyer_id: 2,
        tenant_id: 1,
      });

      this.ipnSend = require('../../src/services/ipn_send').send;
    });

    it('should send an ipn to the url configured in the tenant', function () {
      const expectedResponse = {
        response: 'tudo ok',
      };

      const request = nock('http://www.test.com')
        .post('/', (body) => {
          return true; // _.isEqual(body, expectedResponse)
        })
        .reply(200, expectedResponse);


      return this.ipnSend(this.paymentOrder)
        .then((response) => {
          assert.deepEqual(response.data, expectedResponse);

        })
        .then(() => {
          request.done();
        });
    });

    it('should reject if the ipn failed', function () {
      const expectedResponse = {
        response: 'tudo ok',
      };

      const request = nock('http://www.test.com')
        .post('/', (body) => {
          return true; // _.isEqual(body, expectedResponse)
        })
        .reply(400, expectedResponse);

      return expect(this.ipnSend(this.paymentOrder))
        .to.be.rejected
        .then(() => {
          request.done();
        });
    });

  });

});
