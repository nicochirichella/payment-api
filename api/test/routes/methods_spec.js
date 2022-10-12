function generateInvalidJsonErrorBody(errors) {
  return {
    code: 'json_schema_error',
    message: `There are ${errors.length} errors in the body`,
    context:
      {
        schema: 'paymentMethodUpdate.json',
        missingSchemas: [],
        errors,
      },
    origin: 'payment-api:test',
  };
}

describe('/methods', () => {
  let knex;
  let app;
  const request = require('supertest');
  const assert = require('chai').assert;
  const _ = require('lodash');
  const mockery = require('mockery');

  before(() => {
    mockery.enable({
      warnOnUnregistered: false,
      useCleanCache: true,
    });

    const stubs = require('../stubs');
    mockery.registerMock('./payment_methods/index', stubs.paymentMethods);
    mockery.registerMock('./gateway_methods/index', stubs.gatewayMethods);

    knex = require('../../src/bookshelf').knex;
    app = require('../../src/app');
  });

  after(() => {
    mockery.deregisterMock('./gateway_methods/index');
    mockery.deregisterMock('./payment_methods/index');
    mockery.disable();
  });

  const mockMethods = [
    {
      id: 10, tenant_id: 1, type: 'TYPEA', name: 'MethodA', enabled: true, gateway_method_id: 1,
    },
    {
      id: 11, tenant_id: 1, type: 'TYPEB', name: 'MethodB', enabled: true, gateway_method_id: 2,
    },
    {
      id: 12, tenant_id: 1, type: 'TYPEC', name: 'MethodC', enabled: false, gateway_method_id: 3,
    },
  ];

  const mockGateways = [
    {
      id: 1, tenant_id: 1, type: 'TYPEA', name: 'MethodA', enabled: true, ui_url: 'www.trocafone1.com', payment_method_id: 10,
    },
    {
      id: 2, tenant_id: 1, type: 'TYPEB', name: 'MethodB', enabled: true, ui_url: 'www.trocafone2.com', payment_method_id: 11,
    },
    {
      id: 3, tenant_id: 1, type: 'TYPEC', name: 'MethodC', enabled: false, ui_url: 'www.trocafone3.com', payment_method_id: 12,
    },
    {
      id: 4, tenant_id: 1, type: 'TYPEA', name: 'MethodA', enabled: false, ui_url: 'www.trocafone4.com', payment_method_id: 12,
    },
    {
      id: 5, tenant_id: 1, type: 'TYPEB', name: 'MethodB', enabled: false, ui_url: 'www.trocafone5.com', payment_method_id: 12,
    },
  ];

  beforeEach(() => {
    return Promise.all([
      Promise.all(mockMethods.map(m => knex('payment_methods').insert(m))),
      Promise.all(mockGateways.map(m => knex('gateway_methods').insert(m))),
    ]);
  });

  describe('GET', () => {
    it('should return single enabled payment method', (done) => {
      request(app)
        .get('/test-tenant/v1/methods/TYPEA?api_key=123459876')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.body);
          assert.strictEqual(res.body.id, 10);
          assert.strictEqual(res.body.name, 'MethodA');
          assert.strictEqual(res.body.type, 'TYPEA');
          assert.strictEqual(res.body.enabled, true);
          assert.strictEqual(res.body.ui_url, 'www.trocafone1.com');
          return done();
        });
    });

    it('should return single disabled payment method', (done) => {
      request(app)
        .get('/test-tenant/v1/methods/TYPEC/?api_key=123459876')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.body);
          assert.strictEqual(res.body.id, 12);
          assert.strictEqual(res.body.name, 'MethodC');
          assert.strictEqual(res.body.type, 'TYPEC');
          assert.strictEqual(res.body.enabled, false);
          assert.strictEqual(res.body.ui_url, 'www.trocafone3.com');
          return done();
        });
    });

    it('should return 404 when type not found', (done) => {
      request(app)
        .get('/test-tenant/v1/methods/TYPESARASA?api_key=123459876')
        .expect(404)
        .end(done);
    });

    it('should list all enabled payment methods', (done) => {
      request(app)
        .get('/test-tenant/v1/methods?api_key=123459876')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          assert.isTrue(res.body.length === 2);
          assert.ok(_.find(res.body, { id: 10 }));
          assert.ok(_.find(res.body, { id: 11 }));
          assert.notOk(_.find(res.body, { id: 12 }));
          return done();
        });
    });

    it('should list all payment methods', (done) => {
      request(app)
        .get('/test-tenant/v1/methods?api_key=123459876&filters=enabled:all')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.body.length, 3);
          assert.ok(_.find(res.body, { id: 10 }));
          assert.ok(_.find(res.body, { id: 11 }));
          assert.ok(_.find(res.body, { id: 12 }));
          return done();
        });
    });

    it('should list all payment methods with its gateway method', (done) => {
      request(app)
        .get('/test-tenant/v1/methods?api_key=123459876&filters=enabled:all&relations=gateway_method')
        .expect(200)
        .end((err, res) => {
          assert.sameDeepMembers(res.body, [{
            id: 10, type: 'TYPEA', name: 'MethodA', enabled: true, ui_url: 'www.trocafone1.com', gateway_method: 'TYPEA',
          }, {
            id: 11, type: 'TYPEB', name: 'MethodB', enabled: true, ui_url: 'www.trocafone2.com', gateway_method: 'TYPEB',
          }, {
            id: 12, type: 'TYPEC', name: 'MethodC', enabled: false, ui_url: 'www.trocafone3.com', gateway_method: 'TYPEC',
          }]);
          return done(err);
        });
    });

    it('should list all payment methods with its valid gateway method', (done) => {
      request(app)
        .get('/test-tenant/v1/methods?api_key=123459876&filters=enabled:all&relations=valid_gateway_methods')
        .expect(200)
        .end((err, res) => {
          assert.sameDeepMembers(res.body, [{
            id: 10, type: 'TYPEA', name: 'MethodA', enabled: true, ui_url: 'www.trocafone1.com', valid_gateway_methods: ['TYPEA'],
          }, {
            id: 11, type: 'TYPEB', name: 'MethodB', enabled: true, ui_url: 'www.trocafone2.com', valid_gateway_methods: ['TYPEB'],
          }, {
            id: 12, type: 'TYPEC', name: 'MethodC', enabled: false, ui_url: 'www.trocafone3.com', valid_gateway_methods: ['TYPEC', 'TYPEA', 'TYPEB'],
          }]);
          return done(err);
        });
    });

    it('should list enabled payment methods with its valid gateway method and its gateway method', (done) => {
      request(app)
        .get('/test-tenant/v1/methods?api_key=123459876&relations=valid_gateway_methods,gateway_method')
        .expect(200)
        .end((err, res) => {
          assert.sameDeepMembers(res.body, [{
            id: 10,
            type: 'TYPEA',
            name: 'MethodA',
            enabled: true,
            ui_url: 'www.trocafone1.com',
            valid_gateway_methods: ['TYPEA'],
            gateway_method: 'TYPEA',
          }, {
            id: 11,
            type: 'TYPEB',
            name: 'MethodB',
            enabled: true,
            ui_url: 'www.trocafone2.com',
            valid_gateway_methods: ['TYPEB'],
            gateway_method: 'TYPEB',
          }]);
          return done(err);
        });
    });
  });

  describe('PUT /{id}', () => {
    it('should fail if no editable params are present in the body', (done) => {
      request(app)
        .put('/test-tenant/v1/methods/TYPEA?api_key=123459876')
        .send({ otherParam: 'many', name: 'cats' })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          assert.shallowDeepEqual(res.body, generateInvalidJsonErrorBody([
            {
              dataPath: '/otherParam',
              message: 'Unknown property (not in schema)',
            },
            {
              dataPath: '/name',
              message: 'Unknown property (not in schema)',
            },
          ]));
          return done();
        });
    });

    it('should fail if some editable params are present in the body but it also has invalid params', (done) => {
      request(app)
        .put('/test-tenant/v1/methods/TYPEA?api_key=123459876')
        .send({ enabled: true, name: 'cats' })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          assert.shallowDeepEqual(res.body, generateInvalidJsonErrorBody([
            {
              dataPath: '/name',
              message: 'Unknown property (not in schema)',
            },
          ]));
          return done();
        });
    });

    it('should fail if editable params does not match type', (done) => {
      return request(app)
        .put('/test-tenant/v1/methods/TYPEA?api_key=123459876')
        .send({ enabled: 'asd', gatewayMethod: 1 })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          assert.shallowDeepEqual(res.body, generateInvalidJsonErrorBody([
            {
              dataPath: '/enabled',
              message: 'Invalid type: string (expected boolean)',
            },
            {
              dataPath: '/gatewayMethod',
              message: 'Invalid type: number (expected string)',
            },
          ]));
          return done();
        });
    });


    it('should update the gateway_method of the payment method', (done) => {
      return request(app)
        .put('/test-tenant/v1/methods/TYPEC?api_key=123459876')
        .send({ gatewayMethod: 'TYPEB' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          return knex('payment_methods')
            .first()
            .where({ id: 12 })
            .then((pm) => {
              assert.shallowDeepEqual(pm, {
                gateway_method_id: 5,
                enabled: 0,
              });
              done();
            })
            .catch(done);
        });
    });

    it('should update the enabled flag of the payment method', (done) => {
      return request(app)
        .put('/test-tenant/v1/methods/TYPEC?api_key=123459876')
        .send({ enabled: true })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          return knex('payment_methods')
            .first()
            .where({ id: 12 })
            .then((pm) => {
              assert.shallowDeepEqual(pm, {
                enabled: 1,
                gateway_method_id: 3,
              });
              done();
            })
            .catch(done);
        });
    });


    it('should update both enabled and gateway method of the payment method', (done) => {
      return request(app)
        .put('/test-tenant/v1/methods/TYPEC?api_key=123459876')
        .send({ enabled: true, gatewayMethod: 'TYPEA' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          return knex('payment_methods')
            .first()
            .where({ id: 12 })
            .then((pm) => {
              assert.shallowDeepEqual(pm, {
                gateway_method_id: 4,
                enabled: 1,
              });
              done();
            })
            .catch(done);
        });
    });
  });

  describe('security', () => {
    it('/:id should deny access if not authenticated', (done) => {
      request(app)
        .get('/test-tenant/v1/methods/TYPEA')
        .expect(401)
        .end(done);
    });

    it('/ should deny access if not authenticated', (done) => {
      request(app)
        .get('/test-tenant/v1/methods')
        .expect(401)
        .end(done);
    });
  });
});
