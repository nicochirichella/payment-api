const requireTree = require('require-tree');

module.exports = requireTree('.', { index: 'ignore', name: 'type' });
