'use strict';

const sinon = require('sinon');
const Promise = require('bluebird');

module.exports = {
  incomingIpn: {
    forge: sinon.stub().returnsThis(),
    save: sinon.spy(() => resolve()),
  },
  paymentMethods: {
    TYPEA: {},
    TYPEB: {},
    TYPEC: {},
  },
  gatewayMethods: {
    TYPEA: {},
    TYPEB: {},
    TYPEC: {},
  },
  gateways: {
    TYPEA: {
      parseIpnPayload: sinon.spy(() => resolve([{ client_reference: '666' }])),
      processIpn: sinon.spy(() => resolve({ payment: { get: sinon.stub() }, propagate: true })),
      ipnSuccessResponse(res) { res.send(); },
    },
    TYPEB: {},
  },
  logger: {
    trace: sinon.stub(),
    debug: sinon.stub(),
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    fatal: sinon.stub(),
    child: sinon.stub().returnsThis(),
  },
  ipnSend: sinon.spy(() => resolve()),
  queueService: {
    paymentUpdated: sinon.spy(() => resolve()),
  },
  tokenManager: {
    getToken: sinon.spy(() => resolve('TOKEN')),
    addGatewayConfig: sinon.stub(),
  },
};

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
