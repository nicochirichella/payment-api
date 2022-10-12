'use strict';

describe('#authentication', () => {
  const request = require('supertest');
  const assert = require('chai').assert;
  const express = require('express');
  const validKey = '123459876';

  it('should let client through if authorized', (done) => {
    const app = express();

    app.use((req, res, next) => {
      req.context = {
        authenticated: true,
      };
      next();
    });
    app.use(require('../../src/middleware/authentication').authed);
    app.use((req, res) => { res.send(); });

    request(app)
      .get('/')
      .expect(200)
      .end((err, res) => {
        done(err);
      });
  });

  it('should NOT let client through if unauthorized', (done) => {
    const app = express();

    app.use((req, res, next) => {
      req.context = {
        authenticated: false,
      };
      next();
    });
    app.use(require('../../src/middleware/authentication').authed);
    app.use((req, res) => {
      assert.fail('went through');
    });

    request(app)
      .get('/')
      .expect(401)
      .end((err, res) => {
        done(err);
      });
  });

});
