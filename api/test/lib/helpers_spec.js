'use strict';

describe('lib/helpers', () => {
  const _ = require('lodash');
  const assert = require('chai').assert;
  const helpers = require('../../src/lib/helpers');
  const path = require('path');
  const readAllFiles = require('../../src/services/read_all_files');
  const fixtures = readAllFiles.execute(path.join(__dirname, '../fixtures/soap/mapper-expected-outputs'), 'xml');

  it('maskCreditCardNumber should leave visible only the last 4 digits', (done) => {
    const testData = {
      5432: '5432',
      112345: '**2345',
      12343451234345: '**********4345',
    };

    try {
      _.forIn(testData, (value, key) => assert.equal(helpers.maskCreditCardNumber(key), value));
      done();
    } catch (err) {
      done(err);
    }
  });

  it('maskXML should correctly mask request for logging', (done) => {
    const xmlMock = {
      content:fixtures.authorization,
    };

    const xmlMockFused = {
      content: fixtures.authorizationObfuscated,
    };

    try {
      assert.deepEqual(helpers.maskXML(xmlMock), xmlMockFused);
      done();
    } catch (err) {
      done(err);
    }
  });

  it('maskXML should correctly mask request for logging', (done) => {
    const xmlMock = fixtures.authorization;
    const xmlMockFused = fixtures.authorizationObfuscated;

    try {
      assert.deepEqual(helpers.maskXML(xmlMock), xmlMockFused);
      done();
    } catch (err) {
      done(err);
    }
  });

  it('maskXML should return request as is if no masking is needed', (done) => {
    const xmlMock = fixtures.capture;

    try {
      assert.deepEqual(helpers.maskXML(xmlMock), xmlMock);
      done();
    } catch (err) {
      done(err);
    }
  });

  it('maskCreatePaymentRequest should correctly mask request for logging', (done) => {
    const mockRequest = {
        paymentOrder: {
          payments: [{
            paymentInformation: {
              securityCode: '123',
            }
          }],
        },
    };

    const expected = {
        paymentOrder: {
          payments: [{
            paymentInformation: {
              securityCode: '***',
            }
          }],
        },
    };

    try {
      const ret = helpers.maskCreatePaymentRequest(mockRequest);
      assert.deepEqual(ret, expected);
      done();
    } catch (err) {
      done(err);
    }
  });

  it('maskCreatePaymentRequest should return request as is if no masking is needed', (done) => {
    const mockRequest = {
      requestData: {
        some: 'data',
        someObject: {
          a: 1,
          b: 2,
        },
      },
    };

    const expected = {
      requestData: {
        some: 'data',
        someObject: {
          a: 1,
          b: 2,
        },
      },
    };

    try {
      const ret = helpers.maskCreatePaymentRequest(mockRequest);
      assert.deepEqual(ret, expected);
      done();
    } catch (err) {
      done(err);
    }
  });
});
