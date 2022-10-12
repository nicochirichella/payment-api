const Payment = require('../../models/payment');
const logger = require('../../logger');
const QueueService = require('../../services/queue_service');
const GatewayMethodActionWorker = require('../gateway_method_action_worker');
const PaymentStatus = require('../../models/constants/payment_status');
const _ = require('lodash');

class AuthorizationReverseWorker extends GatewayMethodActionWorker {

  repeatableAction() {
    return this.gatewayMethod.authorizationReversePayment(this.payment, PaymentStatus.rejected);
  }

}

module.exports = AuthorizationReverseWorker;
