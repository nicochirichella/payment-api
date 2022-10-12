'use strict';

const Promise = require('bluebird');
const config = require('../../src/config');
const knex = require('../../src/bookshelf').knex;

if (config.get('env') !== 'test') {
  console.error('NOT RUNNING IN ENV TEST!');
  process.exit(1);
}

module.exports = {
  create: function createSchema() {
    return Promise.all([
      knex.schema.createTable('tenants', (table) => {
        table.bigInteger('id');
        table.string('name');
        table.string('api_key');
        table.string('ipn_url');
        table.date('created_at');
        table.date('updated_at');
      }),
      knex.schema.createTable('payment_methods', (table) => {
        table.integer('id');
        table.integer('tenant_id');
        table.integer('gateway_method_id');
        table.string('type');
        table.string('name');
        table.boolean('enabled');
        table.string('ui_url');
        table.date('created_at');
        table.date('updated_at');
      }),
      knex.schema.createTable('gateway_methods', (table) => {
        table.integer('id');
        table.integer('tenant_id');
        table.string('type');
        table.string('name');
        table.boolean('enabled');
        table.date('created_at');
        table.date('updated_at');
        table.string('ui_url');
        table.integer('pre_execute_ttl');
        table.integer('post_execute_ttl');
        table.boolean('payment_ttl_include_weekends');
        table.integer('payment_method_id');
        table.integer('syncronic_capture');
        table.integer('syncronic_notify_on_creation');
      }),
      knex.schema.createTable('gateways', (table) => {
        table.integer('id');
        table.integer('tenant_id');
        table.string('type');
        table.string('name');
        table.string('base_url');
        table.json('keys');
        table.date('created_at');
        table.date('updated_at');
      }),
      knex.schema.createTable('payments', (table) => {
        table.integer('id');
        table.integer('payment_order_id');
        table.integer('gateway_method_id');
        table.integer('buyer_id');
        table.integer('tenant_id');
        table.integer('installments');
        table.string('client_reference');
        table.string('type');
        table.string('gateway_reference');
        table.string('status_id');
        table.string('status_detail');
        table.string('currency');
        table.json('payment_information');
        table.decimal('amount');
        table.decimal('interest');
        table.json('metadata');
        table.date('created_at');
        table.date('updated_at');
        table.date('expiration_date');
        table.integer('retried_with_payment_id');
      }),
      knex.schema.createTable('payment_orders', (table) => {
        table.integer('id');
        table.string('purchase_reference');
        table.integer('reference');
        table.integer('payment_method_id');
        table.integer('buyer_id');
        table.string('currency');
        table.string('status_id');
        table.string('tenant_id');
        table.decimal('total');
        table.decimal('interest');
        table.date('created_at');
        table.date('updated_at');
        table.json('metadata');
      }),
      knex.schema.createTable('payment_status_history', (table) => {
        table.integer('id');
        table.integer('status_id');
        table.integer('payment_id');
        table.date('date');
      }),
      knex.schema.createTable('buyers', (table) => {
        table.integer('id');
        table.string('external_reference');
        table.string('type');
        table.string('name');
        table.char('gender');
        table.date('birth_date');
        table.string('document_number');
        table.string('document_type');
        table.string('email');
        table.string('phone');
        table.string('ip_address');
        table.string('billing_city');
        table.string('billing_district');
        table.string('billing_country');
        table.string('billing_complement');
        table.string('billing_number');
        table.string('billing_street');
        table.string('billing_state');
        table.string('billing_zip_code');
        table.string('billing_state_code');
        table.string('shipping_city');
        table.string('shipping_district');
        table.string('shipping_country');
        table.string('shipping_complement');
        table.string('shipping_number');
        table.string('shipping_street');
        table.string('shipping_state');
        table.string('shipping_zip_code');
        table.string('shipping_state_code');
        table.date('created_at');
        table.date('updated_at');
      }),
      knex.schema.createTable('items', (table) => {
        table.integer('id');
        table.integer('payment_order_id');
        table.string('name');
        table.string('external_reference');
        table.float('discount');
        table.float('total');
        table.float('unit_cost');
        table.integer('quantity');
        table.string('created_at');
        table.string('updated_at');
        table.string('image_url');
        table.json('details');
      }),
      knex.schema.createTable('failed_ipns', (table) => {
        table.integer('id');
        table.integer('tenant_id');
        table.integer('gateway_id');
        table.string('client_reference');
        table.string('message');
        table.string('payload');
        table.string('created_at');
        table.string('updated_at');
      }),
      knex.schema.createTable('interest_rates', (table) => {
        table.integer('id');
        table.integer('amount');
        table.float('interest');
        table.integer('gateway_method_id');
        table.string('created_at');
        table.string('updated_at');
        table.string('deleted_at');
      }),
      knex.schema.createTable('payment_method_gateway_methods', (table) => {
        table.integer('id');
        table.integer('payment_method_id');
        table.integer('gateway_method_id');
        table.integer('gateway_method_order');
        table.string('created_at');
        table.string('updated_at');
        table.string('deleted_at');
      }),
    ])
      .then(() => {
        return Promise.all([
          knex('tenants').insert({
            id: 1, name: 'test-tenant', ipn_url: 'http://www.test.com', api_Key: '123459876',
          }),
        ]);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  },

  drop() {
    return Promise.all([
      knex.schema.dropTableIfExists('payment_methods'),
      knex.schema.dropTableIfExists('gateway_methods'),
      knex.schema.dropTableIfExists('gateways'),
      knex.schema.dropTableIfExists('tenants'),
      knex.schema.dropTableIfExists('payments'),
      knex.schema.dropTableIfExists('payment_orders'),
      knex.schema.dropTableIfExists('payment_status_history'),
      knex.schema.dropTableIfExists('buyers'),
      knex.schema.dropTableIfExists('items'),
      knex.schema.dropTableIfExists('failed_ipns'),
      knex.schema.dropTableIfExists('interest_rates'),
      knex.schema.dropTableIfExists('payment_method_gateway_methods'),
    ]);
  },
};
