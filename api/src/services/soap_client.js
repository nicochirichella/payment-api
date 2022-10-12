const _ = require('lodash');
const config = require('../config');
const soap = require('soap');
const log = require('../logger');
const helpers = require('../lib/helpers');

class SoapClient {
  constructor(wsdlUrl, userOpts) {
    const opts = userOpts || {};

    if (!wsdlUrl) {
      throw new Error('soap_client.constructor.required_parameters_not_provided');
    }

    this.wsdlUrl = wsdlUrl;
    this.config = _.merge({
      timeout: config.get('client.timeout'),
      disableCache: true,
    }, opts);
    this.security = null;
    this.client = soap.createClientAsync(this.wsdlUrl, this.config);
  }

  setSecurity(user, password) {
    const wsSecurity = new soap.WSSecurity(user, password, {
      mustUnderstand: true,
      hasTimeStamp: false,
      hasTokenCreated: false,
      hasNonce: false,
    });

    return this.client.then((client) => {
      client.setSecurity(wsSecurity);
      this.security = 'wsSecurity';
    });
  }

  runAction(actionName, payload) {
    let body = {};

    if (typeof payload === 'string') {
      body = { $xml: payload };
    } else {
      body = payload;
    }

    const maskedPayload = helpers.maskXML(payload);

    log.debug('soap_client.starting_request', { payload: maskedPayload, actionName });
    return this.client.then((client) => {
      return client[`${actionName}Async`](body).then((response) => {
        const formattedResponse = {
          result: response[0],
          rawResponse: response[1],
          soapHeader: response[2],
          rawRequest: response[3],
        };

        log.debug('soap_client.server_responded', {
          payload: maskedPayload,
          actionName,
          rawResponse: helpers.maskXML(formattedResponse.rawResponse),
          rawRequest: helpers.maskXML(formattedResponse.rawRequest),
        });

        return formattedResponse;
      });
    }).catch((err) => {
      log.error('soap_client.request_failed', { payload: maskedPayload, err });
      throw err;
    });
  }

  describe() {
    return this.client.then(client => client.describe());
  }
}

module.exports = SoapClient;

