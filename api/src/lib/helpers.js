const _ = require('lodash');
const Promise = require('bluebird');

function maskCreditCardNumber(ccNumber) {
  return _.repeat('*', ccNumber.length - 4) + ccNumber.slice(-4);
}

function maskCreatePaymentRequest(request) {
  const requestToObfuscate = _.cloneDeep(request);
  const payments = _.get(requestToObfuscate, 'paymentOrder.payments');
  if(payments) {
    _.map(payments, (p) => {
      if (_.get(p, 'paymentInformation.securityCode')) {
        p.paymentInformation.securityCode = "***";
      }
    });
  }
  return requestToObfuscate;
}

function maskPayments(payments) {
  const paymentsToObfuscate = _.cloneDeep(payments);

  return _.values(paymentsToObfuscate).map((p) => {
    if(p.paymentInformation) {
      p.paymentInformation.securityCode = "***";
    }
    return p
  });
}

function maskXML(payload) {
  const payloadToObfuscate = _.cloneDeep(payload);
  let body;
  if(payloadToObfuscate) {
    if(_.isString(payloadToObfuscate)) {
      return payloadToObfuscate.replace(/<cvNumber>[\s\S]*?<\/cvNumber>/, "<cvNumber>***<\/cvNumber>");
    }

    if(_.isObject(payloadToObfuscate)) {
       return _.mapValues(payloadToObfuscate, (p) => {
         if(_.isString(p)) {
           return p.replace(/<cvNumber>[\s\S]*?<\/cvNumber>/, "<cvNumber>***<\/cvNumber>");
         }
      });
    }

    if( _.isArray(payloadToObfuscate)) {
       return _.map(payloadToObfuscate, (p) => {
         if(_.isString(p)) {
           return p.replace(/<cvNumber>[\s\S]*?<\/cvNumber>/, "<cvNumber>***<\/cvNumber>");
         }
      });
    }


  }

  return body;
}

function promiseSettleFirst(arr, mapper) {
  const errors = [];
  return Promise.map(arr, i =>
    mapper(i).catch(e => errors.push(e)))
    .then((results) => {
      if (errors.length > 0) {
        throw errors[0];
      }
      return results;
    });
}

function promiseAtLeastOne(arr, mapper) {
  const errors = [];
  let resolved = false;
  return new Promise((res, rej) => {
    Promise.map(arr, i =>
      mapper(i).then((v) => {
        if (!resolved) {
          res(v);
          resolved = true;
        }
        return v;
      }).catch(e => errors.push(e)))
      .then(() => {
        if (!resolved) {
          rej(errors[0]);
        }
      });
  });
}

function sleep(timeout) {
  return new Promise(function(resolve) {
    setTimeout(resolve, timeout);
  });
}

function getEncryptedToken(paymentData, encryptionType) {
  const encryptions = _.get(paymentData, 'encryptedCreditCards');
  let token = null;
  if (_.isArray(encryptions)) {
    const encryptedCreditCard = encryptions.find(encryption => encryption.encryptionType === encryptionType);
    token = encryptedCreditCard ? encryptedCreditCard.encryptedContent : token;
  }

  return token;
}

module.exports = {
  maskCreditCardNumber,
  maskCreatePaymentRequest,
  maskPayments,
  maskXML,
  promiseSettleFirst,
  sleep,
  getEncryptedToken,
  promiseAtLeastOne,
};
