'use strict';

describe('#GatewayMethods implementations', () => {
  const _ = require('lodash');
  const assert = require('chai').assert;
  const gatewayMethod = require('../../../src/models/gateway_methods/index');
  const implementationMap = {
    type: 'String',
    gatewayMethodActionType: 'String',
    gatewayType: 'String',
    cancelPayment: 'Function',
    chargeBackPayment: 'Function',
    capturePayment: 'Function',
    validatePayment: 'Function',
  };

  _.each(gatewayMethod, (gm) => {
    describe(gm.type, () => {
      _.each(implementationMap, (type, method) => {
        it(`should implement the interface of ${method} which should be a ${type}`, () => {
          assert[`is${type}`](gm[method]);
        });
      });
    });
  });
});
