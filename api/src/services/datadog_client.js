const datadogClient = require('@trocafone/datadog-client');
const config = require('../config');

function getDatadogClient() {
  const datadogClientConfig = {
    enabled: config.get('datadog.enabled'),
    env: config.get('env'),
    apiKey: config.get('datadog.api_key'),
    appKey: config.get('datadog.app_key'),
    prefix: config.get('datadog.prefix'),
  };

  return datadogClient.newClient(datadogClientConfig);
}

module.exports = getDatadogClient();
