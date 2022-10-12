const _ = require('lodash');
const config = require('../config');
const request = require('request');

function ApiClient(baseUrl, opts) {
  this.baseUrl = baseUrl;
  this.config = _.merge({ timeout: config.get('client.timeout') }, opts);
}

ApiClient.prototype.makeUrl = function makeUrl(path, opts) {
  if (!path) {
    return this.baseUrl;
  }

  let url = `${_.trimRight(this.baseUrl, '/')}/`;
  url += _.trimLeft(path, '/');

  const queryParams = _.merge({}, this.config.queryParams || {}, _.get(opts, 'queryParams') || {});
  if (!_.isEmpty(queryParams) && _.isObject(queryParams)) {
    const separator = (path.indexOf('?') >= 0) ? '&' : '?';

    let qp = _.reduce(this.config.queryParams, (acc, val, key) => {
      acc += `${key}=${val}&`;
      return acc;
    }, '');

    qp = qp.slice(0, -1);

    url += separator + qp;
  }

  return url;
};

ApiClient.prototype.request = function makeRequest(method, path, body, headers, opts) {
  const url = this.makeUrl(path, opts);
  const timeout = this.config.timeout;
  const allHeaders = _.merge({}, this.config.headers, headers);
  let auth = null;
  let form = null;
  let json = true;

  if (opts && opts.auth) {
    auth = opts.auth;
  } else if (this.config.auth) {
    auth = this.config.auth;
  }

  if (opts && opts.type === 'json') {
    json = true;
  }

  if (opts && opts.type === 'form') {
    json = false;
    form = body;
    body = null;
  }

  return new Promise((resolve, reject) => {
    request({
      url,
      method,
      headers: allHeaders,
      json,
      timeout,
      body,
      form,
      auth,
    }, (err, res, resBody) => {
      if (err) {
        return reject(err);
      }

      res.data = resBody;
      return resolve(res);
    });
  });
};

_.each(['get', 'delete', 'head'], (method) => {
  ApiClient.prototype[method] = function makeRequestWithoutBody(path, headers, opts) {
    return this.request(method.toLowerCase(), path, null, headers, opts);
  };
});

_.each(['post', 'put', 'patch'], (method) => {
  ApiClient.prototype[method] = function makeRequestWithBody(path, body, headers, opts) {
    return this.request(method.toLowerCase(), path, body, headers, opts);
  };
});

module.exports = ApiClient;
