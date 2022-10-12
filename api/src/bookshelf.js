const config = require('./config');

const knexConfig = {
  client: config.get('database.client'),
  connection: config.get('database.connection'),
};

const knex = require('knex')(knexConfig);
const Bookshelf = require('bookshelf')(knex);

Bookshelf.plugin('virtuals');
Bookshelf.plugin(require('bookshelf-paranoia'));

module.exports = Bookshelf;
