'use strict';

const expect = require('chai').expect;

describe('#Views', () => {
  describe('Buyer', () => {

    const buyerView = require('../../src/views/buyer');
    const Buyer = require('../../src/models/buyer');

    it('should return a JSON-valid object when given a company buyer without shipping address', () => {
      const buyer = new Buyer(require('../fixtures/models/company_buyer_fixture_without_shipping_address.json'));

      return expect(buyerView(buyer)).to.eventually.be.deep.equal({
        reference: 'EXTERNAL_REFERENCE',
        type: 'company',
        name: 'Roberto Carlos',
        gender: null,
        birthDate: null,
        documentNumber: '21015158464',
        documentType: 'CNPJ',
        email: 'roberto@yopmail.com',
        phone: '4864564558',
        ipAddress: '192.168.0.1',
        billingAddress: {
          country: 'BBR',
          stateCode: 'BRJ',
          state: 'BRio de Janeiro',
          city: 'BRio',
          district: 'BRio',
          complement: 'BPiso 10',
          number: 'B123',
          zipCode: 'B05415060',
          street: 'BRua San Carlos',
        },
      });
    });

    it('should return a JSON-valid object when given a person buyer without shipping address', () => {
      const buyer = new Buyer(require('../fixtures/models/person_buyer_fixture_without_shipping_address.json'));

      return expect(buyerView(buyer)).to.eventually.be.deep.equal({
        reference: 'EXTERNAL_REFERENCE',
        type: 'person',
        name: 'Roberto Carlos',
        gender: 'M',
        birthDate: '1992-05-13',
        documentNumber: '21015158464',
        documentType: 'CPF',
        email: 'roberto@yopmail.com',
        phone: '4864564558',
        ipAddress: '192.168.0.1',
        billingAddress: {
          country: 'BBR',
          stateCode: 'BRJ',
          state: 'BRio de Janeiro',
          city: 'BRio',
          district: 'BRio',
          complement: 'BPiso 10',
          number: 'B123',
          zipCode: 'B05415060',
          street: 'BRua San Carlos',
        },
      });
    });

    it('should return a JSON-valid object when given a person buyer', () => {
      const buyer = new Buyer(require('../fixtures/models/person_buyer_fixture.json'));

      return expect(buyerView(buyer)).to.eventually.be.deep.equal({
        reference: 'EXTERNAL_REFERENCE',
        type: 'person',
        name: 'Roberto Carlos',
        gender: 'M',
        birthDate: '1992-05-13',
        documentNumber: '21015158464',
        documentType: 'CPF',
        email: 'roberto@yopmail.com',
        phone: '4864564558',
        ipAddress: '192.168.0.1',
        billingAddress: {
          country: 'BBR',
          stateCode: 'BRJ',
          state: 'BRio de Janeiro',
          city: 'BRio',
          district: 'BRio',
          complement: 'BPiso 10',
          number: 'B123',
          zipCode: 'B05415060',
          street: 'BRua San Carlos',
        },
        shippingAddress: {
          country: 'SBR',
          stateCode: 'SRJ',
          state: 'SRio de Janeiro',
          city: 'SRio',
          district: 'SRio',
          complement: 'SPiso 10',
          number: 'S123',
          zipCode: 'S05415060',
          street: 'SRua San Carlos',
        },
      });
    });

    it('should return a JSON-valid object when given a company buyer', () => {
      const buyer = new Buyer(require('../fixtures/models/company_buyer_fixture.json'));

      return expect(buyerView(buyer)).to.eventually.be.deep.equal({
        reference: 'EXTERNAL_REFERENCE',
        type: 'company',
        name: 'Roberto Carlos',
        gender: null,
        birthDate: null,
        documentNumber: '21015158464',
        documentType: 'CNPJ',
        email: 'roberto@yopmail.com',
        phone: '4864564558',
        ipAddress: '192.168.0.1',
        billingAddress: {
          country: 'BBR',
          stateCode: 'BRJ',
          state: 'BRio de Janeiro',
          city: 'BRio',
          district: 'BRio',
          complement: 'BPiso 10',
          number: 'B123',
          zipCode: 'B05415060',
          street: 'BRua San Carlos',
        },
        shippingAddress: {
          country: 'SBR',
          stateCode: 'SRJ',
          state: 'SRio de Janeiro',
          city: 'SRio',
          district: 'SRio',
          complement: 'SPiso 10',
          number: 'S123',
          zipCode: 'S05415060',
          street: 'SRua San Carlos',
        },
      });
    });
  });
});
