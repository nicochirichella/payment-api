if ((process.env.TROCA_NEW_RELIC_ENABLED || '').toLowerCase() === 'true') {
  require('newrelic');
}

require('./main');
