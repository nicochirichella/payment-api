'use strict';

const expect = require('chai').expect;

describe('#Views', () => {
  describe('Item', () => {

    const itemView = require('../../src/views/items');
    const Item = require('../../src/models/item');

    it('should return a JSON-valid object when given an array of one item', () => {
      const items = [
        new Item(require('../fixtures/models/item_iphone_fixture.json')),
      ];

      return expect(itemView(items)).to.eventually.be.deep.equal([
        {
          name: 'iPhone 6S 64GB Negro',
          reference: 'ITEM_IPHONE',
          discountAmountInCents: 10002,
          totalCostInCents: 190020,
          unitCostInCents: 100011,
          quantity: 2,
          details: {
            brand: 'Sony',
            model: 'Sony  Xperia',
            has_charger: true,
            storage: '16GB',
            condition: 'Bom'
          }
        },
      ]);
    });

    it('should return a JSON-valid object when given an array of multiple item', () => {
      const items = [
        new Item(require('../fixtures/models/item_iphone_fixture.json')),
        new Item(require('../fixtures/models/item_samsung_fixture.json')),
      ];

      return expect(itemView(items)).to.eventually.be.deep.equal([
        {
          name: 'iPhone 6S 64GB Negro',
          reference: 'ITEM_IPHONE',
          discountAmountInCents: 10002,
          totalCostInCents: 190020,
          unitCostInCents: 100011,
          quantity: 2,
          details: {
              brand: 'Sony',
              model: 'Sony  Xperia',
              has_charger: true,
              storage: '16GB',
              condition: 'Bom'
          }
        },
        {
          name: 'Samsung Galaxy Note 64GB Blanco',
          reference: 'ITEM_SAMSUNG',
          discountAmountInCents: 1000,
          totalCostInCents: 9000,
          unitCostInCents: 10000,
          quantity: 1,
          details: {
              brand: 'Samsung',
              model: 'S7',
              has_charger: true,
              storage: '32GB',
              condition: 'Bom'
          }
        },
      ]);
    });
  });
});
