const AdyenCC = require('../models/gateway_methods/adyen_cc');
const MercadoPagoCC = require('../models/gateway_methods/mercadopago_cc');
const CybersourceCC = require('../models/gateway_methods/cybersource_cc');
const PaypalCC = require('../models/gateway_methods/paypal_cc');
const EncryptionType = require('../models/constants/encryption_type');

const TOKEN_MAP = {
  [EncryptionType.mercadopago]: MercadoPagoCC.type,
  [EncryptionType.cybersource]: CybersourceCC.type,
  [EncryptionType.adyen]: AdyenCC.type,
  [EncryptionType.paypal]: PaypalCC.type,
};

class EncryptionTypeToGatewayMethodMapper {
  getGatewayMethodType(encryptionType) {
    return TOKEN_MAP[encryptionType];
  }
}

module.exports = EncryptionTypeToGatewayMethodMapper;
