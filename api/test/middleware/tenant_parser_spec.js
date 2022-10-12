'use strict';

describe('#tenant_parser', () => {
  const request = require('supertest');
  const assert = require('chai').assert;
  const express = require('express');

  it('should handle valid tenant', (done) => {
    const app = express();
    const tenant = 'test-tenant';

    app.use('/:tenantName', require('../../src/middleware/tenant_parser'));
    app.use((req, res) => {
      assert.strictEqual(req.context.tenant.get('name'), tenant);
      assert.strictEqual(req.context.tenantId, 1);
      res.send();
    });

    request(app)
      .get(`/${tenant}`)
      .expect(200)
      .end(done);
  });

  it('should return unauthorized when tenant not found', (done) => {
    const app = express();

    app.use('/:tenantName', require('../../src/middleware/tenant_parser'));

    request(app)
      .get('/sarasa')
      .expect(401)
      .end(done);
  });
});
