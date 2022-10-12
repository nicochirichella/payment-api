'use strict';

describe('/utils', () => {
  const _ = require('lodash');
  const assert = require('chai').assert;
  const app = require('../../src/app');
  const request = require('supertest');

  it('/health should return 200 and no body', (done) => {
    request(app)
      .get('/utils/health')
      .expect(200)
      .end((err, res) => {
        assert.lengthOf(_.keys(res.body), 0);
        done(err);
      });
  });
});
