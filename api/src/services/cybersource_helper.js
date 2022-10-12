const FlexSDKNode = require('@cybersource/flex-sdk-node');
const config = require('../config');
const logger = require('../logger');


function initializeSdk(mid, serialNumber, sharedSecret) {
  return FlexSDKNode({
    // auth credentials
    mid,
    keyId: serialNumber,
    sharedSecret: sharedSecret,
    production: config.get('env') === 'production',
  });
}

function getTokenizerKey(gateway) {
  const mid = gateway.getKey('merchant_id');
  const flex = this.initializeSdk(mid, gateway.getKey('serial_number'), gateway.getKey('shared_secret'));

  const options = {
    encryptionType: flex.constants.encryptionType.None,
    currency: gateway.getKey('currency'),
  };

  return new Promise(function(resolve, reject) {
    flex.createKey(options, function(err, resp, key) {
      if (err) {
        logger.error('cybersource_helper.get_tokenizer_key.error_creating_token', {
          err,
          merchant_id: mid,
        });
        return reject(new Error('Error creating cybersource token'));
      }

      logger.info('cybersource_helper.tokenizer_key_created', {
        token: key,
        merchant_id: mid,
      });
      return resolve(key);
    });
  });

}

module.exports = {
  getTokenizerKey,
  initializeSdk
};

