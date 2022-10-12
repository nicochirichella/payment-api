const logger = require('@trocafone/logger');

function loggerConfig() {
    let loggerConfig = {};
    loggerConfig.appName = 'payment_api';
    loggerConfig.console = {
        level: 'trace',
    };

    return loggerConfig;
}

function getConfigLogger() {
    return logger.createLogger(loggerConfig());
}

module.exports = getConfigLogger();
