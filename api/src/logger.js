const _ = require('lodash');
const config = require('./config');
const logger = require('@trocafone/logger');
const datadog = require('./services/datadog_client')

function addConsoleConfig(loggerConfig) {
  loggerConfig.console = {
    level: config.get('log.console_level'),
  };
}

function addFileConfig(loggerConfig) {
  const configFile = {
    level: config.get('log.file_level'),
    path: config.get('log.path'),
    name: 'payment-api_app.log',
  };

  if (config.get('log.file_rotate')) {
    configFile.rotate = {
      periodDays: config.get('log.file_rotate_days'),
      count: config.get('log.file_rotate_keep'),
    };
  }

  loggerConfig.file = configFile;
}

function addDatadogConfig(loggerConfig) {
  loggerConfig.datadog = {
    client: datadog,
  };
}

function loggerConfig() {
  let loggerConfig = {};
  loggerConfig.appName = 'payment_api';
  if (config.get('log.enabled')) {
    addConsoleConfig(loggerConfig);
    if (config.get('log.file_enabled')) {
      addFileConfig(loggerConfig);
    }
    if (config.get('log.datadog_enabled')) {
      addDatadogConfig(loggerConfig);
    }
  }

  return loggerConfig;
}

function getConfigLogger() {
  return logger.createLogger(loggerConfig());
}

module.exports = getConfigLogger().child({
  log_type: 'app',
});
