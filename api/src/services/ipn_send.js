const ApiClient = require('./api_client');
const log = require('../logger');
const errors = require('../errors');
const Promise = require('bluebird');

function getIpnUrl(paymentOrder) {
  return paymentOrder
    .related('tenant')
    .fetch()
    .then(tenant => tenant.get('ipn_url'));
}

function ipnSend(paymentOrder) {
  const reference = paymentOrder.get('reference');
  const request = {
    id: paymentOrder.get('id'),
    purchaseReference: paymentOrder.get('purchase_reference'),
    reference,
  };

  log.info('send_ipn.request', {
    reference,
    request,
  });

  return getIpnUrl(paymentOrder)
    .then((url) => {
      const client = new ApiClient(url);
      return client.post('', request);
    })
    .then((resp) => {
      if (resp.statusCode !== 200) {
        const err = new errors.FailResponseError(resp);
        err.code = 'send_ipn.response.non_200';
        err.status = 400;
        err.context = {
          statusCode: resp.statusCode,
          body: resp.data,
        };
        throw err;
      }

      return resp;
    })
    .tap((response) => {
      log.info('send_ipn.response', {
        reference,
        status_code: response.statusCode,
      });
    })
    .catch((err) => {
      log.info('send_ipn.error', {
        reference,
        err,
        error_context: err.context,
      });

      if (err.context) {
        delete err.context;
      }

      err.status = 400;
      throw err;
    });
}

module.exports = {
  send: ipnSend,
};
