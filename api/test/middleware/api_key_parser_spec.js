'use strict';

describe('#api_key_parser', () => {
  const request = require('supertest');
  const assert = require('chai').assert;
  const express = require('express');
  const validKey = '123459876';

  it('should authorize when api_key (by query param) is valid', (done) => {
    const app = express();

    app.use((req, res, next) => {
      req.context = {
        tenant: {
          get: () => '123459876',
        },
      };
      next();
    });
    app.use(require('../../src/middleware/api_key_parser'));
    app.use((req, res) => {
      assert.isTrue(req.context.authenticated);
      assert.strictEqual(req.context.apiKey, validKey);
      res.send();
    });

    request(app)
      .get(`/?api_key=${validKey}`)
      .expect(200)
      .end((err, res) => {
        done(err);
      });
  });

  it('should authorize when api_key (by header) is valid', (done) => {
    const app = express();

    app.use((req, res, next) => {
      req.context = {
        tenant: {
          get: () => validKey,
        },
      };
      next();
    });
    app.use(require('../../src/middleware/api_key_parser'));
    app.use((req, res) => {
      assert.isTrue(req.context.authenticated);
      assert.strictEqual(req.context.apiKey, validKey);
      res.send();
    });

    request(app)
      .get('/')
      .set('X-Api-Key', validKey)
      .expect(200)
      .end(done);
  });

  it('should NOT authorize when invalid api_key', (done) => {
    const app = express();

    app.use((req, res, next) => {
      req.context = {
        tenant: {
          get: () => validKey,
        },
      };
      next();
    });
    app.use(require('../../src/middleware/api_key_parser'));
    app.use((req, res) => {
      assert.isFalse(req.context.authenticated);
      assert.isUndefined(req.context.apiKey);
      res.send();
    });

    request(app)
      .get('/')
      .set('X-Api-Key', 'sarasa')
      .expect(200)
      .end(done);
  });
});
