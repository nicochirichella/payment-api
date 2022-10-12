'use strict';

const moment = require('moment');

const expect = require('chai').expect;
const sinon = require('sinon');
const Promise = require('bluebird');
const assert = require('chai').assert;
const _ = require('lodash');
const tokenManager = require('../../src/services/token_manager');
const nock = require('nock');
const apiC = require('../../src/services/api_client');

describe('Token Manager', () => {

  const configuration = {
    tokenRefreshData: {
      method: 'POST',
      accessTokenResponsePath: 'access_token',
      expirationTimeResponsePath: 'expires_in',
      expirationTimeResponseType: 'countdown',
      expirationTimeResponseUnit: 'seconds',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en_US',
      },
      body: {
        grant_type: 'client_credentials',
      },
      type: 'form',
    },
  };

  beforeEach(() => {
    moment.now = function () {
      return 10;
    };
  });

  describe('#addGatewayConfig', () => {

    it('should add the configuration to the gateway', () => {
      tokenManager.addGatewayConfig('gateway', configuration);
      return assert.equal(tokenManager.gateways.gateway.config, configuration, 'Configuration object should be correct');
    });

    it('should set up the token data with a null token and a current date', () => {
      assert.equal(tokenManager.gateways.gateway.tokenData.token, null, 'Token should be null');
      assert.equal(tokenManager.gateways.gateway.tokenData.expirationTime.format(), moment().utc().format(), 'ExpirationTime should be null');
    });

    it('should throw the correct error if the gatewayName is null', () => {
      expect(() => tokenManager.addGatewayConfig(null, configuration)).to.throw('Gateway name is required');
    });

    it('should throw an error if either of the parameters is null', () => {
      expect(() => tokenManager.addGatewayConfig('gateway', null)).to.throw('Config is required');
    });

  });

  describe('#getGatewayData', () => {

    it('should throw the correct error if the gatewayName is null', () => {
      expect(() => tokenManager.getGatewayData(null)).to.throw('Gateway name is required');
    });

    it('should throw the correct error if the gateway data is not found for that gateway', () => {
      expect(() => tokenManager.getGatewayData('simbad_el_marino')).to.throw('Gateway data could not be recovered');
    });

    it('should return the configuration data if the gateway data found for that gateway', () => {
      expect(tokenManager.addGatewayConfig('gateway', configuration));
      expect(tokenManager.getGatewayData('gateway')).to.deep.equal({
        config: configuration,
        tokenData: {
          token: null,
          expirationTime: moment.utc(),
        },
      });
    });

  });

  describe('#getToken', () => {

    beforeEach(() => {
      tokenManager.addGatewayConfig('gateway', configuration);
      sinon.spy(tokenManager, 'isTokenValid');
    });

    afterEach(() => {
      tokenManager.isTokenValid.restore();
    });

    it('should return back the token if the token exists and its valid', () => {
      tokenManager.gateways.gateway.tokenData = {
        token: 'CURRENT_MOCKED_TOKEN',
        expirationTime: moment('2500-01-01T00:00:00Z'),
      };
      expect(tokenManager.getToken('gateway', {
        user: 'mockUser',
        password: 'mockPassword',
      }, 'www.refreshTokenUrl.com')).to.eventually.equal('CURRENT_MOCKED_TOKEN');
      assert.equal(tokenManager.isTokenValid.returned(true), true, 'Token should have been considered as valid');
    });

    it('should refresh the token if the token was not valid', () => {
      tokenManager.gateways.gateway.tokenData = {
        token: 'CURRENT_MOCKED_TOKEN',
        expirationTime: moment('1930-01-01T00:00:00Z'),
      };
      sinon.stub(tokenManager, 'refreshToken').returns(Promise.resolve('NEW_MOCKED_TOKEN'));
      expect(tokenManager.getToken('gateway', {
        user: 'mockUser',
        password: 'mockPassword',
      }, 'www.refreshTokenUrl.com')).to.eventually.equal('NEW_MOCKED_TOKEN');
      assert.equal(tokenManager.isTokenValid.returned(false), true, 'Token should have been considered as invalid');
      tokenManager.refreshToken.restore();
    });

  });

  describe('#isTokenValid', () => {

    it('should return true if token expires in the future', () => {

      const tokenData = {
        token: 'CURRENT_MOCKED_TOKEN',
        expirationTime: moment('2500-01-01T00:00:00Z'),
      };
      expect(tokenManager.isTokenValid(tokenData)).to.be.true;
    });

    it('should return true if token expires in the future', () => {

      const tokenData = {
        token: 'CURRENT_MOCKED_TOKEN',
        expirationTime: moment('1900-01-01T00:00:00Z'),
      };
      expect(tokenManager.isTokenValid(tokenData)).to.be.false;
    });

    it('should return falsy if no tokenData was passed', () => {
      expect(tokenManager.isTokenValid(null)).to.be.falsy;
    });

    it('should return falsy if tokenData was passed with an invalid token', () => {
      const tokenData = {};
      expect(tokenManager.isTokenValid(tokenData)).to.be.falsy;
    });
  });

  describe('#isTokenValid', () => {

    it('should return true if token expires in the future', () => {

      const tokenData = {
        token: 'CURRENT_MOCKED_TOKEN',
        expirationTime: moment('2500-01-01T00:00:00Z'),
      };
      expect(tokenManager.isTokenValid(tokenData)).to.be.true;
    });

    it('should return true if token expires in the future', () => {

      const tokenData = {
        token: 'CURRENT_MOCKED_TOKEN',
        expirationTime: moment('1900-01-01T00:00:00Z'),
      };
      expect(tokenManager.isTokenValid(tokenData)).to.be.false;
    });

    it('should return falsy if no tokenData was passed', () => {
      expect(tokenManager.isTokenValid(null)).to.be.falsy;
    });

    it('should return falsy if tokenData was passed with an invalid token', () => {
      const tokenData = {};
      expect(tokenManager.isTokenValid(tokenData)).to.be.falsy;
    });
  });

  describe('#refreshToken', () => {
    beforeEach(() => {
      tokenManager.addGatewayConfig('gateway', configuration);
    });

    it('should make a request to the refreshToken url with the correct method, body and headers, adn return token provided', () => {

      const request = nock('https://base.url.com', {
        reqheaders: {
          Accept: 'application/json',
          'Accept-Language': 'en_US',
          'content-type': 'application/x-www-form-urlencoded',
          authorization: 'Basic VVNFUjpQQVNT',
        },
      })
        .post('/', (body) => {
          return _.isEqual(body, {
            grant_type: 'client_credentials',
          });
        }).reply(200, {
          expires_in: 40000,
          access_token: 'NEW_TOKEN',
        });

      return expect(tokenManager.refreshToken('gateway', { user: 'USER', pass: 'PASS' }, 'https://base.url.com/'))
        .to.be.fulfilled
        .then((response) => {
          assert.equal(response, 'NEW_TOKEN', 'Extracted token should be correct');
          request.done();
        });
    });

    it('should throw the correct error if the gateway responds with a 400 error response', () => {

      const request = nock('https://base.url.com', {
        reqheaders: {
          Accept: 'application/json',
          'Accept-Language': 'en_US',
          'content-type': 'application/x-www-form-urlencoded',
          authorization: 'Basic VVNFUjpQQVNT',
        },
      })
        .post('/', (body) => {
          return _.isEqual(body, {
            grant_type: 'client_credentials',
          });
        }).reply(400, {
          expires_in: 40000,
          access_token: 'NEW_TOKEN',
        });


      return expect(tokenManager.refreshToken('gateway', { user: 'USER', pass: 'PASS' }, 'https://base.url.com/'))
        .to.be.rejected
        .then((error) => {
          assert.equal(error.message, 'Non 200 response from gateway', 'Error code should be correct');
        }).then(() => {
          return request.done();
        });


    });

    it('should throw the correct error if the gateway responds with a 500 error response', () => {

      const request = nock('https://base.url.com', {
        reqheaders: {
          Accept: 'application/json',
          'Accept-Language': 'en_US',
          'content-type': 'application/x-www-form-urlencoded',
          authorization: 'Basic VVNFUjpQQVNT',
        },
      })
        .post('/', (body) => {
          return _.isEqual(body, {
            grant_type: 'client_credentials',
          });
        }).reply(500, {
          expires_in: 40000,
          access_token: 'NEW_TOKEN',
        });


      return expect(tokenManager.refreshToken('gateway', { user: 'USER', pass: 'PASS' }, 'https://base.url.com/'))
        .to.be.rejected
        .then((error) => {
          assert.equal(error.message, 'Non 200 response from gateway', 'Error code should be correct');
        }).then(() => {
          return request.done();
        });


    });

    it('should set the new token to tokenData on successful token refresh', () => {

      const request = nock('https://base.url.com', {
        reqheaders: {
          Accept: 'application/json',
          'Accept-Language': 'en_US',
          'content-type': 'application/x-www-form-urlencoded',
          authorization: 'Basic VVNFUjpQQVNT',
        },
      })
        .post('/', (body) => {
          return _.isEqual(body, {
            grant_type: 'client_credentials',
          });
        }).reply(200, {
          expires_in: 40000,
          access_token: 'NEW_TOKEN',
        });

      const randomStub = sinon.stub(Math, 'random').returns(0);
      // If random returns zero, the refreshWindow subtracted to the newly calculated
      // expiration time is always the maximum of the range.

      return expect(tokenManager.refreshToken('gateway', { user: 'USER', pass: 'PASS' }, 'https://base.url.com/'))
        .to.be.fulfilled
        .then((response) => {
          const tokenData = tokenManager.gateways.gateway.tokenData;
          const expectedExpirationDate = moment().utc().add(40000, 'seconds').subtract(tokenManager.refreshWindow.max, 'seconds');
          assert.equal(tokenData.token, 'NEW_TOKEN', 'Extracted token should be correct');
          assert.equal(tokenData.expirationTime.format(), expectedExpirationDate.format(), 'Saved expiration date should be correct');
          request.done();
          randomStub.restore();
        });
    });

    it('should return the correct error if gateways responds successfully but the path to the access_token is incorrect', () => {

      const request = nock('https://base.url.com', {
        reqheaders: {
          Accept: 'application/json',
          'Accept-Language': 'en_US',
          'content-type': 'application/x-www-form-urlencoded',
          authorization: 'Basic VVNFUjpQQVNT',
        },
      })
        .post('/', (body) => {
          return _.isEqual(body, {
            grant_type: 'client_credentials',
          });
        }).reply(200, {
          expires_in: 40000,
          access_token_IN_A_DIFFERENT_PATH: 'NEW_TOKEN', // Changed this!!
        });

      return expect(tokenManager.refreshToken('gateway', { user: 'USER', pass: 'PASS' }, 'https://base.url.com/'))
        .to.be.rejected
        .then((error) => {
          assert.equal(error.message, 'Unable to find token in gateway response', 'Error code should be correct');
          request.done();
        });
    });

    it('should return the correct error if gateways responds successfully but the path to the access_token is incorrect', () => {

      const request = nock('https://base.url.com', {
        reqheaders: {
          Accept: 'application/json',
          'Accept-Language': 'en_US',
          'content-type': 'application/x-www-form-urlencoded',
          authorization: 'Basic VVNFUjpQQVNT',
        },
      })
        .post('/', (body) => {
          return _.isEqual(body, {
            grant_type: 'client_credentials',
          });
        }).reply(200, {
          expires_in_IN_A_DIFFERENT_PATH: 40000, // Changed this!
          access_token: 'NEW_TOKEN',
        });

      return expect(tokenManager.refreshToken('gateway', { user: 'USER', pass: 'PASS' }, 'https://base.url.com/'))
        .to.be.rejected
        .then((error) => {
          assert.equal(error.message, 'Unable to find token in gateway response', 'Error code should be correct');
          request.done();
        });
    });


  });


});

