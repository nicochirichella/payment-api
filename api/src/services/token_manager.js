/**
 * Created by javieranselmi on 10/17/17.
 *
 * Token Manager is a module designed to return an AccessToken to authenticate with an external API.
 * The AccessToken may have an expiry time, and the module will refresh it if the token expired.
 */

const _ = require('lodash');
const Promise = require('bluebird');
const moment = require('moment');
const log = require('../logger');
const ApiClient = require('./api_client');

function TokenManager() {
  this.gateways = {};
  this.refreshWindow = {
    min: 3600, // seconds (1 hour)
    max: 5400, // seconds  (1 hour and a half)
  };
}

TokenManager.prototype.addGatewayConfig = function addGatewayConfig(gatewayName, config) {
  if (!gatewayName) {
    throw new Error('Gateway name is required');
  }

  if (!config) {
    throw new Error('Config is required');
  }

  this.gateways[gatewayName] = {
    config,
    tokenData: {
      token: null,
      expirationTime: moment().utc(),
    },
  };
};

TokenManager.prototype.getGatewayData = function getGatewayData(gatewayName) {
  if (!gatewayName) {
    throw new Error('Gateway name is required');
  }

  const gatewayData = _.get(this, `gateways.${gatewayName}`);
  if (!gatewayData) {
    log.error('token_manager.unable_to_get_gateway_configuration', {
      gatewayName,
    });
    throw new Error('Gateway data could not be recovered');
  }
  return gatewayData;
};

TokenManager.prototype.getToken = function getToken(gatewayName, auth, refreshTokenUrl) {
  const gatewayData = this.getGatewayData(gatewayName);

  if (this.isTokenValid(gatewayData.tokenData)) {
    return Promise.resolve(gatewayData.tokenData.token);
  }
  return this.refreshToken(gatewayName, auth, refreshTokenUrl);
};

TokenManager.prototype.isTokenValid = function isTokenValid(tokenData) {
  const now = moment().utc();
  return (tokenData && tokenData.token && now < tokenData.expirationTime);
};

TokenManager.prototype.refreshToken = function refreshToken(gatewayName, auth, refreshTokenUrl) {
  const gatewayData = this.getGatewayData(gatewayName);
  const tokenRefreshData = gatewayData.config.tokenRefreshData;
  const tokenData = gatewayData.tokenData;
  const apiClient = new ApiClient(refreshTokenUrl);

  return apiClient.request(
    tokenRefreshData.method,
    null,
    tokenRefreshData.body,
    tokenRefreshData.headers, {
      type: tokenRefreshData.type,
      auth,
    },
  )
    .then((response) => {
      const status = response.statusCode;
      if (!_.contains([200, 201], status)) {
        log.error('token_manager.refresh_token.request_to_gateway_failed', {
          gateway: gatewayName,
          response: JSON.parse(response.body),
          status,
        });
        throw new Error('Non 200 response from gateway');
      }

      const parsedBody = JSON.parse(response.body);
      const token = _.get(parsedBody, tokenRefreshData.accessTokenResponsePath);
      const rawExpirationTime = _.get(parsedBody, tokenRefreshData.expirationTimeResponsePath);
      let finalExpirationTime = null;

      switch (tokenRefreshData.expirationTimeResponseType) {
        case 'countdown':
          finalExpirationTime = moment()
            .utc()
            .add(rawExpirationTime, tokenRefreshData.expirationTimeResponseUnit);
          break;
        // If there are new types in the future the can be implemented here
        default:
          break;
      }

      if (!token || !finalExpirationTime || !rawExpirationTime) {
        log.error('token_manager.refresh_token.unable_to_find_token_in_gateway_response', {
          gateway: gatewayName,
          response: parsedBody,
          status: response.statusCode,
        });
        throw new Error('Unable to find token in gateway response');
      }

      const refreshWindowDiff = (this.refreshWindow.min - this.refreshWindow.max);
      const windowInMinutes = (Math.random() * refreshWindowDiff) + this.refreshWindow.max;
      finalExpirationTime = finalExpirationTime.subtract(windowInMinutes, 'seconds');

      tokenData.token = token;
      tokenData.expirationTime = finalExpirationTime;

      log.info('token_manager.refresh_token.token_was_refreshed', {
        gateway: gatewayName,
        token,
      });

      return token;
    });
};

const tokenManager = new TokenManager();
module.exports = tokenManager;
