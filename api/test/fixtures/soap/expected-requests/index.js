const fs = require('fs');
const path = require('path');

function readXml(xmlFileName) {
  return fs.readFileSync(path.join(__dirname, xmlFileName+'.xml'), 'utf8');
}

const simpleObjectResponse = readXml('simple-object');
const simpleObjectWithArray = readXml('simple-object-with-array');
const simpleObjectWithComplexArray = readXml('simple-object-with-complex-array');
const cybersourceSingleItem = readXml('cybersource-single-item');
const cybersourceMultipleItems = readXml('cybersource-multiple-items');

module.exports = {
  simpleObjectResponse,
  simpleObjectWithArray,
  simpleObjectWithComplexArray,
  cybersourceSingleItem,
  cybersourceMultipleItems,
};
