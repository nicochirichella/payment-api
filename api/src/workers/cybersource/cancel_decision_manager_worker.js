const Payment = require('../../models/payment');
const logger = require('../../logger');
const QueueService = require('../../services/queue_service');
const GatewayMethodActionWorker = require('../gateway_method_action_worker');
const _ = require('lodash');

class CancelDecisionManagerWorker extends GatewayMethodActionWorker {

  constructor(paymentId, data) {
    super(paymentId, data);
    this.data.dmRequestId = data.dmRequestId
  }

  repeatableAction() {
    return this.gatewayMethod.cancelManualRevisionPayment(this.payment, this.data);
  }

}

module.exports = CancelDecisionManagerWorker;
