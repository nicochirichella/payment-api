const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const cybersourceHelper = require('../../src/services/cybersource_helper');
const mockery = require('mockery');

describe('Cybersource Helper service', () => {

  let fakeGateway;

  beforeEach(() => {
    fakeGateway = {
      getKey: key => key,
    };
    sinon.spy(fakeGateway, 'getKey');
  });
  describe('#initializeSdk', () => {

    let stub;
    it('should return a flex SDK instance with the correct credentials', () => {
      const flex = cybersourceHelper.initializeSdk("merchantId","serialNumber", "sharedSecret");
      expect(flex.config.mid).to.eql('merchantId');
      expect(flex.config.keyId).to.eql('serialNumber');
      expect(flex.config.sharedSecret).to.eql('sharedSecret');
      expect(flex.config.production).to.eql(false);
    });
  });

  describe('#getTokenizerKey', () => {

    let fakeArguments;
    beforeEach(() => {
      sinon.stub(cybersourceHelper, 'initializeSdk').returns({
        createKey: (options, cb) => {
          expect(options).to.eql({
            encryptionType: "None",
            currency: "currency",
          });
          cb(...fakeArguments)
        },
        constants: {
          encryptionType: {
            None: "None",
          }
        }
      });
    });

    afterEach(() => {
      cybersourceHelper.initializeSdk.restore();
    });

    it('should return a resolved promise with the key if callback is called succesfully', () => {
      fakeArguments = [null, null, "key"];
      return expect(cybersourceHelper.getTokenizerKey(fakeGateway))
        .to.eventually.eql("key");
    });

    it('should return a rejected promise with the key if callback is called with error', () => {
      fakeArguments = [new Error("connection_error"), null, null];
      return expect(cybersourceHelper.getTokenizerKey(fakeGateway))
        .to.be.rejectedWith("Error creating cybersource token");
    });

  });
});
