const util = require('util');
const _ = require('lodash');

const codeName = {
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  500: 'Internal Server Error',
};

function HttpError(status, message, context) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.status = status;
  this.code = _.snakeCase(this.defaultMessage(status));
  this.message = message || this.defaultMessage(status);
  this.context = context;
}

function FailResponseError(error) {
  Error.captureStackTrace(this, this.constructor);
  this.message = error.message;
  this.status = error.status;
  this.requestBody = _.get(error, 'config.data');
  this.body = error.data;
  this.url = _.get(error, 'config.url');
  this.headers = error.headers;
  this.error = error;
  this.code = 'gateway_non_200_response';
  this.devMessage = 'Request to gateway respond a non 200 status code and was not catched';
  this.context = {
    url: this.url,
    body: this.body,
    headers: this.headers,
    requestBody: this.requestBody,
  };
}

function RequestError(error) {
  Error.captureStackTrace(this, this.constructor);
  this.message = error.message;
  this.host = error.host;
  this.errno = error.errno;
  this.port = error.port;
  this.error = error;
  this.code = 'gateway_request_error';
  this.devMessage = 'Request to gateway has an error';
  this.context = {
    host: this.host,
    errno: this.errno,
    port: this.port,
  };
}

function ValidationError(model, error) {
  Error.captureStackTrace(this, this.constructor);
  this.message = error.message;
  this.status = 400;
  this.code = 'validation_error';
  this.devMessage = 'There was a validation error.';
  this.context = {
    errors: error.errors,
  };
}

function JsonSchemaError(schema, body, validation) {
  Error.captureStackTrace(this, this.constructor);
  this.message = 'There are % errors in the body'.replace('%', validation.errors.length);
  this.status = 400;
  this.code = 'json_schema_error';
  this.devMessage = `Your body does not match with the schema ${schema}`;
  this.context = {
    schema,
    missingSchemas: validation.missing,
    errors: _.map(validation.errors, (error) => {
      delete error.stack;

      error.subErrors = _.map(error.subErrors, (subError) => {
        delete subError.stack;
        return subError;
      });

      return error;
    }),
  };
}

function InvalidStateChangeError(fromState, toState) {
  Error.captureStackTrace(this, this.constructor);
  this.name = 'InvalidStateChangeError';
  this.message = `Invalid state change: from "${fromState}" to "${toState}"`;
  this.devMessage = this.message;
  this.status = 409;
  this.code = 'invalid_state_change';
  this.context = {
    fromState,
    toState,
  };
}

function ModelError() {
  Error.captureStackTrace(this, this.constructor);
}

function NoMatchingStatusError(status) {
  this.name = 'NoMatchingStatusError';
  this.message = 'There was an error matching the provided status';
  this.unknownStatus = status || null;
  Error.captureStackTrace(this, this.constructor);
}

function SkipIpnError() {
  this.name = 'SkipIpnError';
  this.message = 'The ipn is considered irrelevant and will be skipped';
  Error.captureStackTrace(this, this.constructor);
}

function ParseIpnError() {
  this.name = 'ParseIpnError';
  this.message = 'The ipn parsing had an error and will be skipped';
  Error.captureStackTrace(this, this.constructor);
}

function PriceMismatchError(paymentsPrice, itemsPrice) {
  this.status = 400;
  this.code = 'price_mismatch_error';
  this.message = 'The sum of the payments amounts and the items amounts does not match.';
  this.devMessage = `Expected paymentsPrice: ${paymentsPrice} to be equal to itemsPrice: ${itemsPrice}`;
}

function InterestMismatchError(calculatedInt, frontendInt) {
  this.status = 400;
  this.code = 'interest_mismatch_error';
  this.message = 'The calculated interest and the one in the request does not match.';
  this.devMessage = ` Expected calculatedInterest: ${calculatedInt} to be equal to frontendInterest: ${frontendInt}`;
}

function InvalidAmountOfInstallments(installments, gatewayMethod) {
  this.status = 400;
  this.code = 'Installment_amount_invalid';
  this.message = 'Error validating interest rate for payment.';
  this.devMessage = `${installments} is not a valid amount of installments for ${gatewayMethod}`;
}

function InvalidActionForCurrentPaymentStatus(status, action) {
  this.name = 'InvalidActionForCurrentPaymentStatus';
  this.status = 400;
  this.code = 'invalid_action_for_current_payment_state';
  this.message = 'Error performing action on payment due to its status_id.';
  this.devMessage = `Error performing action  "${action}" for payment. Action is not valid for status_id "${status}".`;
}

function InvalidParameters(parameters) {
  this.name = 'InvalidParameters';
  this.status = 400;
  this.code = 'invalid_parameters';
  this.message = 'Invalid parameters sent';
  this.devMessage = 'Check interface of the endpoint or the values that the params sent and try again';
  this.context = {
    parameters,
  };
}

function FieldToSignNotFound(fields, missingField) {
    this.name = 'SignDataNotFound';
    this.status = 400;
    this.code = 'sign_data_not_found';
    this.message = 'Sign data not found';
    this.devMessage = 'Error signing data, signing data not found';
    this.context = {
        'missingField': missingField
    };
}

function InvalidEncryptionTypes() {
  this.name = 'InvalidEncryptionType';
  this.message = 'There was not any valid encryption type in encyrpted cards';
}

function PaymentMethodWithoutConfiguredGatewayMethod() {
  this.name = 'PaymentMethodWithoutConfiguredGatewayMethod';
  this.message = 'There is no gateway method configured for this payment method';
}

util.inherits(InvalidStateChangeError, Error);
util.inherits(JsonSchemaError, Error);
util.inherits(ValidationError, Error);
util.inherits(FailResponseError, Error);
util.inherits(RequestError, Error);
util.inherits(HttpError, Error);
util.inherits(ModelError, Error);
util.inherits(NoMatchingStatusError, ModelError);
util.inherits(SkipIpnError, ModelError);
util.inherits(PriceMismatchError, Error);
util.inherits(InvalidParameters, Error);
util.inherits(FieldToSignNotFound, Error);
util.inherits(InvalidEncryptionTypes, Error);
util.inherits(PaymentMethodWithoutConfiguredGatewayMethod, Error);

HttpError.prototype.defaultMessage = status => codeName[status] || '';

module.exports = {
  HttpError,
  BadRequest: HttpError.bind(null, 400),
  UnauthorizedError: HttpError.bind(null, 401),
  NotFoundError: HttpError.bind(null, 404),
  InternalServerError: HttpError.bind(null, 500),
  RequestError,
  FailResponseError,
  ValidationError,
  JsonSchemaError,
  InvalidStateChangeError,
  ModelError,
  NoMatchingStatusError,
  SkipIpnError,
  PriceMismatchError,
  InterestMismatchError,
  InvalidAmountOfInstallments,
  InvalidActionForCurrentPaymentStatus,
  InvalidParameters,
  FieldToSignNotFound,
  ParseIpnError,
  InvalidEncryptionTypes,
  PaymentMethodWithoutConfiguredGatewayMethod,
};
