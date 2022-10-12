'use strict';

const mockery = require('mockery');
const stubs = require('../stubs');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const shallowDeepEqual = require('chai-shallow-deep-equal');
const chaiXml = require('chai-xml');

chai.use(chaiAsPromised);
chai.use(shallowDeepEqual);
chai.use(chaiXml);


beforeEach(() => {
  return require('./mockSchema').create();
});

afterEach(() => {
  return require('./mockSchema').drop();
});
