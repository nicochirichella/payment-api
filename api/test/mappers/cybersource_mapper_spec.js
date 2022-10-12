const _ = require('lodash');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const nock = require('nock');
const helpers = require('../helpers');
const os = require('os');
const CybersourceMapper = require('../../src/mappers/cybersource_mapper');
const readAllFiles = require('../../src/services/read_all_files');
const path = require('path');
const Promise = require('bluebird');
const item = require('../../src/models/item');
const buyer = require('../../src/models/buyer');

let paymentMock;
let mapper;
let paymentOrderMock;
let buyerMock;
let itemsMock;
let knex;
const requestDataMock = require('../fixtures/paymentCreationRequest/cybersource_payment_order');

const fixtures = readAllFiles.execute(path.join(__dirname, '../fixtures/soap/mapper-expected-outputs'), 'xml');

describe('#Mappers :: Cybersource', () => {

  // Set up the mocked payment
  beforeEach(() => {
    knex = require('../../src/bookshelf').knex;
    const paymentMetadata = {
      authRequestId: 'AUTHORIZATION_REQUEST_ID',
      captureRequestId: 'CAPTURE_REQUEST_ID',
      dmRequestId: 'DECISION_REQUEST_ID',
    };

    const paymentOrderMetadata = {
        delivery: {
            type: 'normal',
            estimated_time: 6
        }
    };
    return helpers.createPaymentMock(paymentMetadata, paymentOrderMetadata).then((payment) => {
      paymentMock = payment;
    });
  });

  // Set up all the payment-related entities and the mapper
  beforeEach(() => {
    return paymentMock.getRelation('paymentOrder')
      .then((paymentOrder) => {
        const buyerPromise = paymentOrder.getRelation('buyer');
        const itemsPromise = paymentOrder.getRelation('items');
        return Promise.join(buyerPromise, itemsPromise, (buyer, items) => {
          buyerMock = buyer;

          items.first().set('details', {
              brand: "Sony",
              model: "Sony  Xperia Z ULTRA",
              has_charger: true,
              storage: "16GB",
              condition: "Bom"
          });

          itemsMock = items;
          paymentOrderMock = paymentOrder;
          mapper = new CybersourceMapper();
        });
      });
  });

  describe('#getSystemSpecificData', () => {
    it('should get the correct system information', () => {
      const systemData = mapper.getSystemSpecificData();
      return assert.deepEqual(systemData, {
        library: 'Node',
        version: process.version,
        osInfo: `OS - Type: ${os.type()}, Release: ${os.release()}, Platform: ${os.platform()}`,
      });

    });
  });

  describe('#getMerchantMetadataXML', () => {
    it('should return the expected partial XML', () => {
      return expect(mapper.getMerchantMetadataXML(paymentMock)).to.equal(fixtures.merchantMetadata);
    });
  });

  describe('#getInstallmentsXML', () => {
    it('should return the expected partial XML', () => {
      return expect(mapper.getInstallmentsXML(paymentMock)).to.equal(fixtures.installments);
    });
  });

  describe('#getClientMetadataXML', () => {
    it('should return the expected partial XML', () => {

      sinon.stub(mapper, 'getSystemSpecificData', () => {
        return {
          library: 'node',
          version: 'version',
          osInfo: 'osInfo',
        };
      });

      return expect(mapper.getClientMetadataXML()).to.equal(fixtures.clientMetadata);
    });
  });

  describe('#getPurchaseTotalsXML', () => {
    it('should return the expected XML', () => {
      return expect(mapper.getPurchaseTotalsXML(paymentMock)).xml.to.equal(fixtures.purchaseTotals);
    });
  });

  describe('#getRecurringSubscriptionInfoXML', () => {
    it('should return the expected XML', () => {
      return expect(mapper.getRecurringSubscriptionInfoXML(requestDataMock)).xml.to.equal(fixtures.recurringSubscriptionInfo);
    });
  });

  describe('#getCardXML', () => {
    it('should return the expected XML', () => {
      return expect(mapper.getCardXML(requestDataMock)).xml.to.equal(fixtures.card);
    });
  });

  describe('#getItemsXML', () => {
    it('should return the expected partial XML with a single item', () => {
      return expect(mapper.getItemsXML(itemsMock)).to.equal(fixtures.singleItem);
    });

    it('should return the expected partial XML with multiple items', () => {
      return knex('items')
        .insert({
          id: 2,
          payment_order_id: 1,
          name: 'Otro telefono',
          external_reference: '4500',
          discount: 20,
          total: 80.00,
          unit_cost: 40.00,
          quantity: 2,
          image_url: 'www.trocafone.com/image_phone_2',
        })
        .then(() => item.where('id', 'IN', [1, 2]).fetchAll())
        .then((itemsCollection) => {
          itemsMock = itemsCollection;
          return assert.deepEqual(mapper.getItemsXML(itemsMock), fixtures.multipleItems);
        });
    });
  });

  describe('#getBillToXML', () => {
    it('should return the expected partial XML with a person buyer', () => {
      return expect(mapper.getBillToXML(buyerMock)).to.equal(fixtures.billToPerson);
    });

    it('should return the expected partial XML with a company buyer', () => {

      return knex('buyers')
        .where({ id: 21 })
        .update({
          type: 'company',
          name: 'Ingbee Corporation',
          birth_date: null,
          gender: null,
          document_number: '32938606000169',
          document_type: 'CNPJ',
        }).then(() => buyer.where('id', 21).fetch())
        .then((buyerInstance) => {
          buyerMock = buyerInstance;
          return assert.deepEqual(mapper.getBillToXML(buyerMock), fixtures.billToCompany);
        });
    });

    it('should return the expected partial XML with a person buyer with optional fields null', () => {

      return knex('buyers')
        .where({ id: 21 })
        .update({
          billing_complement: null,
        }).then(() => buyer.where('id', 21).fetch())
        .then((buyerInstance) => {
          buyerMock = buyerInstance;
          return assert.deepEqual(mapper.getBillToXML(buyerMock), fixtures.billToPersonOptionalsNull);
        });
    });
  });

  describe('#getDecisionManagerXML', () => {
    it('should return the expected partial XML', () => {

      sinon.stub(mapper, 'getSystemSpecificData', () => {
        return {
          library: 'node',
          version: 'version',
          osInfo: 'osInfo',
        };
      });

        const aditionalData = {
            amountOfPayments: 1,
        };

      const result = helpers.compressXML(mapper.getDecisionManagerXML(
        paymentMock,
        paymentOrderMock,
        buyerMock,
        itemsMock,
        requestDataMock,
        aditionalData
      ));

      const expected = helpers.compressXML(fixtures.decisionManager);
      return expect(result).to.equal(expected);
    });
  });

  describe('#getAuthorizationXML', () => {
    it('should return the expected partial XML', () => {

      sinon.stub(mapper, 'getSystemSpecificData', () => {
        return {
          library: 'node',
          version: 'version',
          osInfo: 'osInfo',
        };
      });

      const result = helpers.compressXML(mapper.getAuthorizationXML(
        paymentMock,
        paymentOrderMock,
        buyerMock,
        itemsMock,
        requestDataMock,
      ));

      const expected = helpers.compressXML(fixtures.authorization);
      return expect(result).to.equal(expected);
    });
  });

  describe('#getCaptureXML', () => {
    it('should return the expected partial XML', () => {

      sinon.stub(mapper, 'getSystemSpecificData', () => {
        return {
          library: 'node',
          version: 'version',
          osInfo: 'osInfo',
        };
      });

      const result = helpers.compressXML(mapper.getCaptureXML(
        paymentMock,
        paymentOrderMock,
        buyerMock,
        itemsMock,
        requestDataMock
      ));

      const expected = helpers.compressXML(fixtures.capture);
      return expect(result).to.equal(expected);
    });
  });

  describe('#getVoidXML', () => {
    it('should return the expected partial XML', () => {

      sinon.stub(mapper, 'getSystemSpecificData', () => {
        return {
          library: 'node',
          version: 'version',
          osInfo: 'osInfo',
        };
      });

      const result = helpers.compressXML(mapper.getVoidXML(
        paymentMock,
        paymentOrderMock,
        buyerMock,
        itemsMock,
        requestDataMock,
      ));

      const expected = helpers.compressXML(fixtures.void);
      return expect(result).to.equal(expected);
    });
  });

  describe('#getChargebackXML', () => {
      it('should return the expected partial XML', () => {

          sinon.stub(mapper, 'getSystemSpecificData', () => {
              return {
                  library: 'node',
                  version: 'version',
                  osInfo: 'osInfo',
              };
          });

          const result = helpers.compressXML(mapper.getChargebackXML(
              paymentMock,
              paymentOrderMock,
              buyerMock,
              itemsMock,
              requestDataMock,
          ));

          const expected = helpers.compressXML(fixtures.chargeback);
          return expect(result).to.equal(expected);
      });
  });

  describe('#getManuallyRejectCaseXML', () => {
    it('should return the expected partial XML', () => {

      sinon.stub(mapper, 'getSystemSpecificData', () => {
        return {
          library: 'node',
          version: 'version',
          osInfo: 'osInfo',
        };
      });

      const result = helpers.compressXML(mapper.getManuallyRejectCaseXML(
        paymentMock,
        paymentOrderMock,
        buyerMock,
        itemsMock,
        requestDataMock,
        { dmRequestId: 'DECISION_REQUEST_ID' }
      ));

      const expected = helpers.compressXML(fixtures.manuallyRejectCase);
      return expect(result).to.equal(expected);
    });
  });

  describe('#getAuthorizationReversalXML', () => {
    it('should return the expected partial XML', () => {

      sinon.stub(mapper, 'getSystemSpecificData', () => {
        return {
          library: 'node',
          version: 'version',
          osInfo: 'osInfo',
        };
      });

      const result = helpers.compressXML(mapper.getAuthorizationReversalXML(
        paymentMock,
        paymentOrderMock,
        buyerMock,
        itemsMock,
        requestDataMock,
      ));

      const expected = helpers.compressXML(fixtures.authorizationReversal);
      return expect(result).to.equal(expected);
    });
  });

  describe('#getCreditXML', () => {
    it('should return the expected partial XML', () => {

      sinon.stub(mapper, 'getSystemSpecificData', () => {
        return {
          library: 'node',
          version: 'version',
          osInfo: 'osInfo',
        };
      });

      const result = helpers.compressXML(mapper.getCreditXML(
        paymentMock,
        paymentOrderMock,
        buyerMock,
        itemsMock,
        requestDataMock,
      ));

      const expected = helpers.compressXML(fixtures.credit);
      return expect(result).to.equal(expected);
    });
  });

});
