var _ = require('lodash');

var baseEnv = {
    logEnabled: true
};

var envs = {
    "development": _.extend({}, baseEnv, {
        env: 'development',
        port: 8444,
        apiEndpointUrl: 'https://192.168.10.117:8443/v1/payments',
    })
};

var envName = process.env.NODE_ENV||'development';
var env = envs[envName];
if (!env) {
    console.error('Invalid env: '+envName);
    process.exit(1);
}

module.exports = env;
