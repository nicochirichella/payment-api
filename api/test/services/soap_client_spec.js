const expect = require('chai').expect;
const sinon = require('sinon');
const Promise = require('bluebird');
const assert = require('chai').assert;
const _ = require('lodash');
const SoapClient = require('../../src/services/soap_client');
const nock = require('nock');
const moment = require('moment');
const config = require('../../src/config');
const wdslMock = require('../fixtures/soap/wdsl/say-hello-service');
const SayHelloServiceResponse = require('../fixtures/soap/wdsl/say-hello-service-response');

const sampleRequests = require('../fixtures/soap/sample-requests');
const sampleCybersourceRequests = require('../fixtures/soap/sample-cybersource-requests');
const expectedResponses = require('../fixtures/soap/expected-requests/index');


describe('SOAP Client', () => {

  describe('#Constructor', () => {

    let wdslConstructorMock;

    beforeEach(() => {
      nock.disableNetConnect();
      wdslConstructorMock = nock('http://www.example.com')
        .get('/example.wdsl')
        .reply(200, wdslMock);
    });

    it('should add the configuration to the gateway', () => {
      return expect(() => new SoapClient(null, {})).to.throw('soap_client.constructor.required_parameters_not_provided');
    });

    it('should merge the configuration provided with the general timeout', () => {

      const soapClient = new SoapClient('http://www.example.com/example.wdsl', {
        disableCache: true,
        property1: 'property1',
      });

      return soapClient.client.then(() => {
        return expect(soapClient.config).to.eql({
          timeout: config.get('client.timeout'),
          property1: 'property1',
          disableCache: true,
        });
      });
    });

    it('should have the default configuration if no configuration provided', () => {

      const soapClient = new SoapClient('http://www.example.com/example.wdsl');
      return expect(soapClient.config).to.eql({
        timeout: config.get('client.timeout'),
        disableCache: true,
      });
    });

  });

  describe('methods', () => {

    let wdslScope;
    let soapClient;

    beforeEach(() => {
      nock.disableNetConnect();
      wdslScope = nock('http://www.example.com')
        .get('/example.wdsl')
        .reply(200, wdslMock);
      soapClient = new SoapClient('http://www.example.com/example.wdsl');
    });

    describe('#describe', () => {

      const expectedServiceMap = {
        Hello_Service: {
          Hello_Port: {
            sayHello: {
              input: {firstName: 'xsd:string'},
              output: {greeting: 'xsd:string'},
            },
          },
        },
      };

      it('should have the correct wdsl', () => {
        soapClient.describe().then((description) => {
          expect(description).to.eql(expectedServiceMap);
        });
      });
    });


    describe('#runAction - happy cases', () => {

      let sayHelloScope;

      beforeEach(() => {
        sayHelloScope = nock('http://www.examples.com')
          .post('/SayHello/')
          .reply(200, SayHelloServiceResponse);
      });

      afterEach(() => {
        sayHelloScope.done();
      });

      it('should set correctly the security', () => {
        return soapClient.setSecurity('user', 'password').then(() => {
          return soapClient.runAction('sayHello', { firstName: 'holis' });
        }).then((res) => {
          expect(res.rawRequest).to.match(new RegExp(/<wsse:Security.*>.*<\/wsse:Security>/gm));
          expect(res.rawRequest).to.match(new RegExp(/<wsse:Username.*>user<\/wsse:Username>/gm));
          expect(res.rawRequest).to.match(new RegExp(/<wsse:Password.*>password<\/wsse:Password>/gm));
          sayHelloScope.done();
        });
      });

      it('should run the specified action and get the correct response', () => {

        return soapClient.runAction('sayHello', {firstName: 'holis'})
          .then((res) => {
            expect(res.rawResponse).to.eql(SayHelloServiceResponse);
          });
      });

      it('should parse correctly a javascript simple object supplied as input', () => {
        return soapClient.runAction('sayHello', sampleRequests.simpleObject)
          .then((res) => {
            expect(res.rawRequest).xml.to.equal(expectedResponses.simpleObjectResponse);
          });
      });

      it('should parse correctly a javascript simple object with array supplied as input', () => {
        return soapClient.runAction('sayHello', sampleRequests.simpleObjectWithArray)
          .then((res) => {
            expect(res.rawRequest).xml.to.equal(expectedResponses.simpleObjectWithArray);
          });
      });

      it('should parse correctly a javascript simple object with complex array supplied as input', () => {
        return soapClient.runAction('sayHello', sampleRequests.simpleObjectWithComplexArray)
          .then((res) => {
            expect(res.rawRequest).xml.to.equal(expectedResponses.simpleObjectWithComplexArray);
          });
      });


      it('should parse correctly a sample cybersource request with a single item', () => {
        return soapClient.runAction('sayHello', sampleCybersourceRequests.singleItem)
          .then((res) => {
            expect(res.rawRequest).xml.to.equal(expectedResponses.cybersourceSingleItem);
          });
      });


      it('should parse correctly a sample cybersource request with multiple items', () => {
        return soapClient.runAction('sayHello', sampleCybersourceRequests.multipleItems)
          .then((res) => {
            expect(res.rawRequest).xml.to.equal(expectedResponses.cybersourceMultipleItems);
          });
      });

    });

    describe('#runAction - fail cases', () => {
      it('should fail if an object with nulls supplied as input', () => {
        return expect(soapClient.runAction('sayHello', sampleRequests.objectWithNulls)).to.be.rejectedWith('TypeError');
      });

      it('should fail and throw the error if server responds with a request error', () => {
        nock('http://www.examples.com')
          .post('/SayHello/')
          .replyWithError({'message': 'ENOTFOUND'});
        return expect(soapClient.runAction('sayHello', sampleRequests.simpleObject)).to.be.rejectedWith('ENOTFOUND');
      });

    });

  });

})
;

