const logger = require('../logger');
const promiseRetry = require('promise-retry');

class GatewayMethodActionWorker {

  constructor(paymentId, data) {
    this.paymentId = paymentId;
    this.data = data || {};
    this.promiseRetry = promiseRetry;

    this.retryOptions = {
      retries: 3,
      factor: 2,
      minTimeout: 8000,
      maxTImeout: 30000,
    };
  }

  getPayment() {
    const Payment = require('../models/payment');
    return Payment.forge({
      id: this.paymentId,
    }).fetch({
      withRelated: ['gatewayMethod']
    }).tap((p) => {
      if (!p) {
        throw new Error('Payment with that id does not exist in database');
      }
    }).catch((err) => {
      logger.error('worker.fetch_payment.failed', {
        payment: this.paymentId,
        error: err
      });
      throw new Error('Cannot fetch payment from database');
    });
  }

  execute() {
    return this.getPayment().then((p) => {
      return p.getRelation('gatewayMethod').then((gm) => {
        this.gatewayMethod = gm;
        this.payment = p;
        return this.callRetryFunction().then(() => {
          logger.info('worker.cancel_decision_manger.successful');
        }).catch((err) => {
          logger.warn('worker.cancel_manual_revision_payment.cancel_decision_manger.error', {
            error: err
          });
          throw err
        });
      });
    });
  }

  callRetryFunction() {
    const repeatableAction = this.repeatableAction;
    return this.promiseRetry((retry, number) => {
      return this.repeatableAction()
        .catch(retry);
    }, this.retryOptions)
  }

  repeatableAction() {
    return Promise.reject(new Error("Not implemented"));
  }
}

module.exports = GatewayMethodActionWorker;
