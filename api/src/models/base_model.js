const bookshelf = require('../bookshelf');
const errors = require('../errors');
const Checkit = require('checkit');
const _ = require('lodash');
const Promise = require('bluebird');

const BaseModel = bookshelf.Model.extend({
  hasTimestamps: true,

  initialize() {
    this.on('saving', this.validate.bind(this));

    this.on('fetched', Promise.method((model, attributes, options) => {
      if (!(options && options.withRelated)) {
        return null;
      }

      return Promise
        .map(options.withRelated, relation => model.related(relation))
        .map(m => m.triggerThen('fetched', m, m.attributes));
    }));
  },

  validations: {},
  conditionalValidations: [],
  validate() {
    const model = this;
    const checkit = new Checkit(this.validations);

    _.each(this.conditionalValidations, (validation) => {
      checkit.maybe(...validation);
    });

    return checkit.run(this.attributes)
      .catch((err) => {
        throw new errors.ValidationError(model, err);
      });
  },

  getRelation(name, opts) {
    const relation = this.relations[name];
    if (relation) {
      return Promise.resolve(relation);
    }

    return this[name]().fetch(opts)
      .then((model) => {
        if (model instanceof bookshelf.Collection) {
          return Promise.all(model.map(m => m.triggerThen('fetched')))
            .then(() => model);
        }
        return model;
      });
  },
}, {
  extend(...args) {
    return bookshelf.Model.extend.apply(this, args);
  },
});

BaseModel.transaction = bookshelf.transaction.bind(bookshelf);
BaseModel.bookshelf = bookshelf;

module.exports = BaseModel;
