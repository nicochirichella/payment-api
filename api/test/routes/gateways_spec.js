
describe('/gateways', () => {
  let knex,
    stubs,
    app;
  const sinon = require('sinon');
  const assert = require('chai').assert;
  const _ = require('lodash');
  const mockery = require('mockery');
  const request = require('supertest');
  let Payment,
    PaymentFetch;

  before(() => {
    mockery.enable({
      warnOnUnregistered: false,
      useCleanCache: true,
    });

    stubs = require('../stubs');
    mockery.registerMock('./gateways', stubs.gateways);
    mockery.registerMock('../services/queue_service', stubs.queueService);
    mockery.registerMock('./incoming_ipn', stubs.incomingIpn);


    knex = require('../../src/bookshelf').knex;
    app = require('../../src/app');
    Payment = require('../../src/models/payment');
  });

  after(() => {
    mockery.deregisterMock('./incoming_ipn');
    mockery.deregisterMock('../services/queue_service');
    mockery.deregisterMock('./gateways');
    mockery.disable();
  });

  const mockGateways = [
    {
      id: 10, tenant_id: 1, type: 'TYPEA', name: 'GatewayA',
    },
    {
      id: 11, tenant_id: 1, type: 'TYPEB', name: 'GatewayC',
    },
  ];

  beforeEach(() => {
    PaymentFetch = sinon.stub(Payment.prototype, 'fetch');
    PaymentFetch.returns(resolve({ id: 1 }));

    return Promise.all(mockGateways.map(g => knex('gateways').insert(g)));
  });

  afterEach(() => {
    PaymentFetch.restore();
  });

  describe('GET', () => {
    it('should return single gateway', (done) => {
      request(app)
        .get('/test-tenant/v1/gateways/TYPEA?api_key=123459876')
        .expect(200)
        .end((err, res) => {
          assert.ok(res.body);
          assert.strictEqual(res.body.id, 10);
          assert.strictEqual(res.body.name, 'GatewayA');
          assert.strictEqual(res.body.type, 'TYPEA');
          done(err);
        });
    });

    it('should return 404 when type not found', (done) => {
      request(app)
        .get('/test-tenant/v1/gateways/TYPESARASA?api_key=123459876')
        .expect(404)
        .end(done);
    });

    it('should list all gateways', (done) => {
      request(app)
        .get('/test-tenant/v1/gateways?api_key=123459876')
        .expect(200)
        .end((err, res) => {
          assert.isTrue(res.body.length === 2);
          assert.ok(_.find(res.body, { id: 10 }));
          assert.ok(_.find(res.body, { id: 11 }));
          done(err);
        });
    });
  });

  describe('POST', () => {
    it('/ipn should process IPN, save payload, and send the event "paymentUpdated"', (done) => {
      stubs.gateways.TYPEA.processIpn.reset();
      stubs.incomingIpn.save.reset();

      request(app)
        .post('/test-tenant/v1/gateways/TYPEA/ipn')
        .type('xml')
        .send('<tag></tag>')
        .expect(200)
        .end((err, res) => {
          assert.isTrue(stubs.gateways.TYPEA.processIpn.calledOnce, 'processIpn not called on gateway');
          assert.isTrue(stubs.queueService.paymentUpdated.calledOnce, 'queueService.paymentUpdated not called');
          assert.isTrue(stubs.incomingIpn.save.calledOnce, 'save not called on IncomingIpn');
          done();
        });
    });
  });

  describe('security', () => {
    it('/:id should deny access if not authenticated', (done) => {
      request(app)
        .get('/test-tenant/v1/gateways/TYPEA')
        .expect(401)
        .end(done);
    });

    it('/ should deny access if not authenticated', (done) => {
      request(app)
        .get('/test-tenant/v1/gateways')
        .expect(401)
        .end(done);
    });

    it('/:id/ipn should NOT deny access if not authenticated', (done) => {
      request(app)
        .post('/test-tenant/v1/gateways/TYPEA/ipn')
        .type('xml')
        .send('<tag></tag>')
        .expect(200)
        .end(done);
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
