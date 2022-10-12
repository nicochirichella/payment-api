module.exports = {
  singleItem:
    {
      merchantID: 'trocafone_br',
      merchantReferenceCode: 'your_merchant_reference_code',
      clientLibrary: 'PHP',
      clientLibraryVersion: '5.5.38',
      clientEnvironment: 'Darwin Javiers-MacBook-Pro-2.local 17.6.0 Darwin Kernel Version 17.6.0: Tue May  8 15:22:16 PDT 2018; root:xnu-4570.61.1~1/RELEASE_X86_64 x86_64',
      billTo: {
        firstName: 'John',
        lastName: 'Doe',
        street1: '1295 Charleston Road',
        city: 'Mountain View',
        state: 'CA',
        postalCode: '94043',
        country: 'US',
        email: 'null@cybersource.com',
        ipAddress: '10.7.111.111',
      },
      item: {
        attributes: {
          id: '0',
        },
        unitPrice: '12.34',
        quantity: '2',

      },
      purchaseTotals: {
        currency: 'USD',
      },
      ccAuthService: {
        attributes: {
          run: 'true',
        },
      },
    },
  multipleItems:
    {
      merchantID: 'trocafone_br',
      merchantReferenceCode: 'your_merchant_reference_code',
      clientLibrary: 'PHP',
      clientLibraryVersion: '5.5.38',
      clientEnvironment: 'Darwin Javiers-MacBook-Pro-2.local 17.6.0 Darwin Kernel Version 17.6.0: Tue May  8 15:22:16 PDT 2018; root:xnu-4570.61.1~1/RELEASE_X86_64 x86_64',
      billTo: {
        firstName: 'John',
        lastName: 'Doe',
        street1: '1295 Charleston Road',
        city: 'Mountain View',
        state: 'CA',
        postalCode: '94043',
        country: 'US',
        email: 'null@cybersource.com',
        ipAddress: '10.7.111.111',
      },
      item1: {
          attributes: {
            id: '0',
          },
          unitPrice: '12.34',
          quantity: '2',

        },
      item2: {
          attributes: {
            id: '1',
          },
          unitPrice: '99.99',
          quantity: '4',

        },
      purchaseTotals: {
        currency: 'USD',
      },
      ccAuthService: {
        attributes: {
          run: 'true',
        },
      },
    },

};

