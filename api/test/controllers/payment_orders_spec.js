const expect = require('chai').expect;
const controller = require('../../src/controllers/payment_orders');
const fixture1Payment = require('../fixtures/paymentCreationRequest/payment_order_single_payment');
const fixture3Payment = require('../fixtures/paymentCreationRequest/payment_order_three_payments');

describe('#Payment Orders controller', () => {
  describe('#processPaymentData', () => {
    it('should transform request body to expected payment creation object for one payment', () => {
      expect(controller.processPaymentData(fixture1Payment.paymentOrder)).to.be.eql({
        'PAYMENT_API_REFERENCE_1_1': {
          "installments": 6,
          "amountInCents": 100000,
          "interestInCents": 10000,
          "type": "creditCard",
          "clientReference": "PAYMENT_API_REFERENCE_1_1",
          "currency": "BRL",

          "paymentInformation": {
            "processor": "visa",
            "lastFourDigits": 1234,
            "firstSixDigits": 123456,
            "holderDocumentNumber": "40111222"
          },

          "encryptedCreditCards":[{
            "encryptedContent": "{{credit_card_token}}",
            "encryptionType": "mercadopagoToken"
          }]
        }
      })
    });

    it('should transform request body to expected payment creation object for three payment', () => {
      expect(controller.processPaymentData(fixture3Payment.paymentOrder)).to.be.eql({
        'PAYMENT_API_REFERENCE_1_1': {
        "installments": 6,
        "amountInCents": 30000,
        "interestInCents": 3000,
        "type": "creditCard",
          "clientReference": "PAYMENT_API_REFERENCE_1_1",
          "currency": "BRL",

        "paymentInformation": {
        "processor": "visa",
          "lastFourDigits": 1234,
          "firstSixDigits": 123456,
          "holderDocumentNumber": "40111222"
      },

        "encryptedCreditCards": [{
        "encryptedContent": "{{credit_card_token}}",
          "encryptionType": "mercadopagoToken"
      }]
      },
      'PAYMENT_API_REFERENCE_2_1': {
        "installments": 6,
        "amountInCents": 30000,
        "interestInCents": 3000,
        "type": "creditCard",
        "clientReference": "PAYMENT_API_REFERENCE_2_1",
        "currency": "BRL",

        "paymentInformation": {
        "processor": "visa",
          "lastFourDigits": 1234,
          "firstSixDigits": 123456,
          "holderDocumentNumber": "40111222"
      },

        "encryptedCreditCards": [{
        "encryptedContent": "{{credit_card_token}}",
          "encryptionType": "mercadopagoToken"
      }]
      },
      'PAYMENT_API_REFERENCE_3_1': {
        "installments": 6,
        "amountInCents": 40000,
        "interestInCents": 4000,
        "type": "creditCard",
        "clientReference": "PAYMENT_API_REFERENCE_3_1",
        "currency": "BRL",

        "paymentInformation": {
        "processor": "visa",
          "lastFourDigits": 1234,
          "firstSixDigits": 123456,
          "holderDocumentNumber": "40111222"
      },

        "encryptedCreditCards": [{
        "encryptedContent": "{{credit_card_token}}",
          "encryptionType": "mercadopagoToken"
      }]
      }
      })
    });
  });
});
