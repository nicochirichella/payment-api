const hb = require('handlebars');
const readAllFiles = require('../services/read_all_files');
const path = require('path');
const Buyer = require('../models/constants/buyer_type');
const os = require('os');
const _ = require('lodash');
const CybersourceStatus = require('../models/constants/cybersource_statuses');
const helpers = require('../lib/helpers');
const EncryptionType = require('../models/constants/encryption_type');

class CybersourceMapper {
  constructor() {
    const templateFilesRaw = readAllFiles.execute(path.join(__dirname, './templates/cybersource'), 'hbs');
    const handlebarsTemplates = _.mapValues(templateFilesRaw, (value) => {
      return hb.compile(value, { strict: true });
    });

    this.temps = handlebarsTemplates;
  }

  getSystemSpecificData() {
    return {
      library: 'Node',
      version: process.version,
      osInfo: `OS - Type: ${os.type()}, Release: ${os.release()}, Platform: ${os.platform()}`,
    };
  }

  getMerchantMetadataXML(payment) {
    return this.temps.merchantMetadata({
      merchantID: 'trocafone_br',
      merchantReferenceCode: payment.get('client_reference'),
    });
  }

  getClientMetadataXML() {
    const systemData = this.getSystemSpecificData();
    return this.temps.clientMetadata({
      clientLibrary: systemData.library,
      clientLibraryVersion: systemData.version,
      clientEnvironment: systemData.osInfo,
    });
  }

  getMerchantDefinedDataXML(paymentOrder, buyer, items, payment, aditionalData) {
      const delivery = _.get(paymentOrder.get('metadata'), 'delivery');
      let useTwoCreditCard = "No";

      let has_discount = false;

      if (_.get(aditionalData, 'amountOfPayments') !== 1) {
          useTwoCreditCard = "Yes";
      }

      const firstItemDetails = items.first().get('details');
      const brand = _.get(firstItemDetails, 'brand');
      const model = _.get(firstItemDetails, 'model');
      const hasCharger = _.get(firstItemDetails, 'has_charger');
      const storage = _.get(firstItemDetails, 'storage');
      const condition = _.get(firstItemDetails, 'condition');
      const deliveryType = _.get(delivery, 'type');
      const deliveryTime = _.get(delivery, 'estimated_time');

      return this.temps.merchantDefinedData({
          brand: brand,
          model: model,
          has_charger: hasCharger,
          delivery_type: deliveryType,
          delivery_time: deliveryTime,
          payment_choice: payment.get('type'),
          use_two_credit_card: useTwoCreditCard,
          installments: payment.get('installments'),
          discount: has_discount,
          gender: buyer.get('gender'),
          phone_storage: storage,
          cellphone_condition: condition,
          buyer_type: buyer.get('type'),
          cpf: payment.get('payment_information').holderDocumentNumber,
      });
  }

  getBillToXML(buyer) {
    const buyerType = buyer.get('type');

    const billTo = {
      street1: `${buyer.get('billing_street')} ${buyer.get('billing_number')}`,
      street2: buyer.get('billing_complement'),
      city: buyer.get('billing_city'),
      state: buyer.get('billing_state_code'),
      county: buyer.get('billing_district'),
      postalCode: buyer.get('billing_zip_code'),
      phoneNumber: buyer.get('phone'),
      country: 'BR',
      email: buyer.get('email'),
      ipAddress: buyer.get('ip_address'),
    };

    if (buyerType === Buyer.person) {
      billTo.firstName = buyer.get('first_name');
      billTo.lastName = buyer.get('last_name');
      billTo.dateOfBirth = buyer.get('birth_date');
      billTo.personalID = buyer.get('document_number');
      return this.temps.billToPerson(billTo);
    }
    billTo.company = buyer.get('name');
    billTo.companyTaxID = buyer.get('document_number');
    return this.temps.billToCompany(billTo);
  }

  getShipToXML(buyer) {
      const buyerType = buyer.get('type');

      const shipTo = {
          street1: `${buyer.get('shipping_street')} ${buyer.get('shipping_number')}`,
          street2: buyer.get('shipping_complement'),
          city: buyer.get('shipping_city'),
          state: buyer.get('shipping_state_code'),
          county: buyer.get('shipping_district'),
          postalCode: buyer.get('shipping_zip_code'),
          phoneNumber: buyer.get('phone'),
          country: 'BR',
          email: buyer.get('email'),
      };

      if (buyerType === Buyer.person) {
          shipTo.firstName = buyer.get('first_name');
          shipTo.lastName = buyer.get('last_name');
          shipTo.dateOfBirth = buyer.get('birth_date');
          shipTo.personalID = buyer.get('document_number');
          return this.temps.shipToPerson(shipTo);
      }
      shipTo.company = buyer.get('name');
      return this.temps.shipToCompany(shipTo);
  }

  getItemsXML(items) {
    return items.map((item, index) => {
      return this.temps.item({
        id: index,
        unitPrice: item.get('unit_cost'),
        quantity: item.get('quantity'),
      });
    }).join('');
  }

  getPurchaseTotalsXML(payment) {
    return this.temps.purchaseTotals({
      currency: payment.get('currency'),
      grandTotalAmount: payment.get('total'),
    });
  }

  getCardXML(requestData) {
    return this.temps.card({
      securityCode: requestData.paymentInformation.securityCode,
    });
  }

  getInstallmentsXML(payment) {
    return this.temps.installments({
      installmentsAmount: payment.get('installments'),
    });
  }

  getRecurringSubscriptionInfoXML(requestData) {
    return this.temps.recurringSubscriptionInfo({
      subscriptionID: helpers.getEncryptedToken(requestData, EncryptionType.cybersource),
    });
  }

  getDecisionManagerXML(payment, paymentOrder, buyer, items, requestData, aditionalData) {
    const partials = {
      merchantMetadata: this.getMerchantMetadataXML(payment),
      clientMetadata: this.getClientMetadataXML(),
      billTo: this.getBillToXML(buyer),
      shipTo: this.getShipToXML(buyer),
      items: this.getItemsXML(items),
      purchaseTotals: this.getPurchaseTotalsXML(payment),
      merchantDefinedData: this.getMerchantDefinedDataXML(paymentOrder, buyer, items, payment, aditionalData),
      recurringSubscriptionInfo: this.getRecurringSubscriptionInfoXML(requestData),
      deviceFingerprintId: _.get(requestData, 'paymentInformation.deviceFingerprintId'),
    };
    return this.temps.decisionManager(partials);
  }

  getAuthorizationXML(payment, paymentOrder, buyer, items, requestData) {
    const partials = {
      merchantMetadata: this.getMerchantMetadataXML(payment),
      clientMetadata: this.getClientMetadataXML(),
      billTo: this.getBillToXML(buyer),
      shipTo: this.getShipToXML(buyer),
      items: this.getItemsXML(items),
      purchaseTotals: this.getPurchaseTotalsXML(payment),
      installments: this.getInstallmentsXML(payment),
      card: this.getCardXML(requestData),
      recurringSubscriptionInfo: this.getRecurringSubscriptionInfoXML(requestData),
    };
    return this.temps.authorization(partials);
  }

  getCaptureXML(payment, paymentOrder, buyer, items, requestData) {
    const partials = {
      merchantMetadata: this.getMerchantMetadataXML(payment),
      clientMetadata: this.getClientMetadataXML(),
      items: this.getItemsXML(items),
      purchaseTotals: this.getPurchaseTotalsXML(payment),
      installments: this.getInstallmentsXML(payment),
      authRequestId: payment.get('metadata').authRequestId,
    };

    return this.temps.capture(partials);
  }

  getCreditXML(payment, paymentOrder, buyer, items, requestData) {
    const partials = {
      merchantMetadata: this.getMerchantMetadataXML(payment),
      clientMetadata: this.getClientMetadataXML(),
      items: this.getItemsXML(items),
      purchaseTotals: this.getPurchaseTotalsXML(payment),
      captureRequestId: payment.get('metadata').captureRequestId,
    };

    return this.temps.credit(partials);
  }

  getChargebackXML(payment, paymentOrder, buy, items, requestData) {
      const partials = {
          merchantMetadata: this.getMerchantMetadataXML(payment),
          clientMetadata: this.getClientMetadataXML(),
          markingRequestID: payment.get('metadata').dmRequestId,
          actionCode: 'ST',
          markingReason: 'Suspect'
      };
      return this.temps.chargeback(partials);
  }

  getVoidXML(payment, paymentOrder, buyer, items, requestData) {
    const partials = {
      merchantMetadata: this.getMerchantMetadataXML(payment),
      clientMetadata: this.getClientMetadataXML(),
      captureRequestId: payment.get('metadata').captureRequestId,
    };

    return this.temps.void(partials);
  }

  getAuthorizationReversalXML(payment, paymentOrder, buyer, items, requestData) {
    const partials = {
      merchantMetadata: this.getMerchantMetadataXML(payment),
      clientMetadata: this.getClientMetadataXML(),
      items: this.getItemsXML(items),
      purchaseTotals: this.getPurchaseTotalsXML(payment),
      authRequestId: payment.get('metadata').authRequestId,
    };


    return this.temps.authorizationReversal(partials);
  }

  getManuallyRejectCaseXML(payment, paymentOrder, buyer, items, requestData, aditionalData) {
    const partials = {
      merchantMetadata: this.getMerchantMetadataXML(payment),
      clientMetadata: this.getClientMetadataXML(),
      dmRequestId: aditionalData.dmRequestId,
      requestedStatus: CybersourceStatus.reject,
    };


    return this.temps.manuallyRejectCase(partials);
  }
}

module.exports = CybersourceMapper;
