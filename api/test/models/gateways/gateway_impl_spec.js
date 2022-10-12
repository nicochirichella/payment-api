'use strict';

describe('#GatewayMethods implementations', () => {
  const _ = require('lodash');
  const assert = require('chai').assert;

  const gateways = require('../../../src/models/gateways/index');
  const implementationMap = {
    type: 'String',
    statusMap: 'Object',
    statusDetailsMap: 'Object',
    createPayment: 'Function',
    cancelPayment: 'Function',
    ipnSuccessResponse: 'Function',
    ipnFailResponse: 'Function',
    getClient: 'Function',
    parseIpnPayload: 'Function',
    createPaymentData: 'Function',
    translateIpnStatus: 'Function',
    translateAuthorizeStatus: 'Function',
    extractGatewayReference: 'Function',
    buildMetadata: 'Function',
    translateIpnStatusDetail: 'Function',
    translateAuthorizeStatusDetail: 'Function',
    capturePayment: 'Function',
  };

  _.each(gateways, (g) => {
    describe(g.type, () => {
      _.each(implementationMap, (type, method) => {
        it(`should implement the interface of ${method} which should be a ${type}`, () => {
          assert[`is${type}`](g[method]);
        });
      });
    });
  });
});
