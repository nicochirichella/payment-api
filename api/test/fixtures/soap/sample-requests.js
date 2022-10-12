const _ = require('lodash');

const simpleObject = {
  firstName: 'John',
  lastName: 'Doe',
};

const usernameArray = ['LaLluvia', 'Morgolock', 'DungeonVeriil'];
const likesArray = [{
  id: 1,
}, {
  id: 2,
}];

const simpleObjectWithArray = Object.assign({
  usernames: usernameArray,
}, simpleObject);

const simpleObjectWithComplexArray = Object.assign({
  likes: likesArray,
}, simpleObject);

const objectWithNulls = Object.assign({
  ego: null,
}, simpleObject);


const cybersourceLikeRequest = {

};

module.exports = {
  simpleObject,
  simpleObjectWithArray,
  simpleObjectWithComplexArray,
  objectWithNulls,
};

