const convict = require('convict');
const path = require('path');

const conf = convict({
  env: {
    default: 'development',
    doc: 'The applicaton environment',
    format: ['production', 'staging', 'development', 'test'],
    env: 'NODE_ENV',
  },
  port: {
    default: 8443,
    doc: 'Port',
    format: 'port',
    env: 'PAYMENT_API_PORT',
  },
  ssl: {
    default: true,
    doc: 'Use SSL',
    format: Boolean,
    env: 'PAYMENT_API_SSL',
  },
  baseUrl: {
    default: 'https://payment.trocafone.local:8433/',
    doc: 'Base URL',
    format: 'url',
    env: 'PAYMENT_API_BASE_URL',
  },
  front: {
    baseUrl: {
      default: 'https://payment-frontend.trocafone.local:8444',
      doc: 'payment-front base URL',
      format: 'url',
      env: 'PAYMENT_API_FRONT_URL',
    },
    paypalRedirectUri: {
      default: 'paypal-cc-redirect/index.html',
      doc: 'payment-front paypal credit card redirect screen URI',
      format: String,
      env: 'PAYMENT_API_FRONT_PAYPAL_CC_REDIRECT_URL',
    },
  },
  database: {
    client: {
      default: 'pg',
      doc: 'Database connection client',
      format: String,
      env: 'PAYMENT_API_DB_CLIENT',
    },
    connection: {
      default: 'postgres://trocafone:trocafone@database.trocafone.local:5432/payment_api',
      doc: 'Database connection string',
      format: String,
      env: 'PAYMENT_API_DB_CONNECTION',
    },
  },
  client: {
    timeout: {
      default: 30000,
      doc: 'API client timeout',
      format: 'int',
      env: 'PAYMENT_API_CLIENT_TIMEOUT',
    },
  },
  log: {
    enabled: {
      default: true,
      doc: 'Enable logging',
      format: Boolean,
      env: 'PAYMENT_API_LOG_ENABLED',
    },
    console_level: {
      default: 'trace',
      doc: 'Logging level for console logging',
      format: String,
      env: 'PAYMENT_API_CONSOLE_LOG_LEVEL',
    },
    datadog_enabled: {
      default: true,
      doc: 'Enable sending data to Datadog',
      format: Boolean,
      env: 'PAYMENT_API_DATADOG_LOG_ENABLED',
    },
    file_enabled: {
      default: false,
      doc: 'Enable logging via file',
      format: Boolean,
      env: 'PAYMENT_API_FILE_LOG_ENABLED',
    },
    file_level: {
      default: 'trace',
      doc: 'Logging level for file logging',
      format: String,
      env: 'PAYMENT_API_FILE_LOG_LEVEL',
    },
    path: {
      default: path.resolve(__dirname, '../logs'),
      doc: 'Logs path',
      format: String,
      env: 'PAYMENT_API_LOG_PATH',
    },
    file_rotate: {
      default: true,
      doc: 'Enable log rotation',
      format: Boolean,
      env: 'PAYMENT_API_LOG_FILE_ROTATE',
    },
    file_rotate_days: {
      default: 1,
      doc: 'Log rotation',
      format: 'int',
      env: 'PAYMENT_API_LOG_FILE_ROTATION_DAYS',
    },
    file_rotate_keep: {
      default: 7,
      doc: 'Log keep x files from rotation',
      format: 'int',
      env: 'PAYMENT_API_LOG_FILE_KEEP_COUNT',
    },
  },
  schema: {
    path: {
      default: path.resolve(__dirname, 'schemas'),
      doc: 'JSON schema path',
      format: String,
      env: 'PAYMENT_API_JSON_SCHEMA_PATH',
    },
  },
  checkout: {
    name: {
      default: 'Trocafone',
      format: String,
    },
    logo_url: {
      default: 'https://payment-frontend.trocafone.com/assets/images/trocafone_70x70.png',
      format: String,
    },
    color: {
      default: 'null',
      format: String,
    },
  },
  datadog: {
    enabled: {
      default: false,
      format: Boolean,
      doc: 'Enable or disable datadog integration',
    },
    prefix: {
      default: 'payment_service.api.',
      format: String,
      doc: 'Datadog log prefix',
    },
    api_key: {
      default: '',
      format: String,
      doc: 'Datadog API KEY',
      env: 'DATADOG_API_KEY',
    },
    app_key: {
      default: '',
      format: String,
      doc: 'Datadog APP KEY',
      env: 'DATADOG_APP_KEY',
    },
    flush_interval_seconds: {
      default: 10,
      format: Number,
      doc: 'Period of time where the metrics will flush to datadog',
    },
  },
});

conf.loadFile(`${__dirname}/conf/${conf.get('env')}.json`);
conf.validate({ strict: true });

module.exports = conf;
