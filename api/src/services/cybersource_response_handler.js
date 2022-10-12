const _ = require('lodash');
const CybersourceStatus = require('../models/constants/cybersource_statuses');

class CybersourceResponseHandler {
  constructor() {
    this.decisionManager = null;
    this.authorization = null;
  }

  setDecisionManager(dmResponse) {
    if (!dmResponse) {
      throw new Error('Trying to set null dm response');
    }
    this.decisionManager = dmResponse;
  }

  setAuthorization(authResponse) {
    if (!authResponse) {
      throw new Error('Trying to set null auth response');
    }
    this.authorization = authResponse;
  }

  getDecisionManagerDecision() {
    return _.get(this.decisionManager, 'decision') || null;
  }

  getAuthorizationDecision() {
    return _.get(this.authorization, 'decision') || null;
  }

  dmPassed() {
    return _.includes([CybersourceStatus.accept, CybersourceStatus.review], this.getDecisionManagerDecision());
  }

  dmReviewedButAuthRejected() {
    return this.getDecisionManagerDecision() === CybersourceStatus.review
    && this.getAuthorizationDecision() !== CybersourceStatus.accept;
  }

  dmReviewed() {
    return this.getDecisionManagerDecision() === CybersourceStatus.review;
  }
}

module.exports = CybersourceResponseHandler;

