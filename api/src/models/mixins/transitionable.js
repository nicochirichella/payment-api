const _ = require('lodash');
const Promise = require('bluebird');
const errors = require('../../errors');
const PaymentStatus = require('../constants/payment_status');
const knex = require('../../bookshelf').knex;
const log = require('../../logger');

function Transitionable() {}

Transitionable.validTransitions = {
  creating: [PaymentStatus.pendingAuthorize, PaymentStatus.error, PaymentStatus.rejected,
    PaymentStatus.authorized, PaymentStatus.pendingCancel, PaymentStatus.cancelled,
    PaymentStatus.successful, PaymentStatus.pendingCapture, PaymentStatus.pendingClientAction],

  pendingAuthorize: [PaymentStatus.authorized, PaymentStatus.pendingCancel,
    PaymentStatus.cancelled, PaymentStatus.rejected, PaymentStatus.successful],

  authorized: [PaymentStatus.pendingCapture, PaymentStatus.pendingCancel,
    PaymentStatus.cancelled, PaymentStatus.successful],

  pendingCapture: [PaymentStatus.successful, PaymentStatus.cancelled,
    PaymentStatus.chargedBack, PaymentStatus.refunded,
    PaymentStatus.inMediation, PaymentStatus.rejected,
    PaymentStatus.pendingCancel],

  successful: [PaymentStatus.cancelled, PaymentStatus.chargedBack,
    PaymentStatus.partialRefund, PaymentStatus.refunded,
    PaymentStatus.pendingCancel, PaymentStatus.inMediation],

  partialRefund: [PaymentStatus.cancelled, PaymentStatus.refunded,
    PaymentStatus.pendingCancel],

  inMediation: [PaymentStatus.cancelled, PaymentStatus.partialRefund,
    PaymentStatus.refunded, PaymentStatus.successful,
    PaymentStatus.pendingCancel, PaymentStatus.chargedBack],

  pendingCancel: [PaymentStatus.cancelled, PaymentStatus.partialRefund,
    PaymentStatus.refunded, PaymentStatus.rejected],

  pendingClientAction: [PaymentStatus.successful, PaymentStatus.cancelled, PaymentStatus.rejected,
    PaymentStatus.pendingCancel, PaymentStatus.pendingExecute],

  pendingExecute: [PaymentStatus.successful, PaymentStatus.cancelled, PaymentStatus.rejected,
    PaymentStatus.pendingCancel, PaymentStatus.authorized, PaymentStatus.pendingAuthorize],

  refunded: [PaymentStatus.refunded],

};

Transitionable.ignorableTransitions = {
  pendingCancel: [PaymentStatus.pendingAuthorize, PaymentStatus.authorized,
    PaymentStatus.pendingClientAction, PaymentStatus.pendingCapture, PaymentStatus.successful],
};

// unsafeInvalidTransitionsToStatus - Map(PaymentStatus, PaymentStatus[])
// The key reference to the toStatus, and the array as value contain all the fromStatus.
// This map represent the transitions that are harmful to do and might be considered as
// errors because there is a change in the base concept: The money is in our hands or not.
// This does not mean that transitions that are invalid, but not contained in the map
// are not errors, but they are considered or cataloged as "safe" invalid transitions.
//
// Ex 1:
// fromStatus: rejected, toStatus: cancelled
// It's an invalid transition, but it's considered "safe" because you are trying to
// cancel an already rejected payment. So the money was never in our hands and with
// this transition, will not also be in our hands.
//
// Ex 2:
// fromStatus: rejected, toStatus: authorized
// This is also an invalid transition, but it's "unsafe", because in the initial state
// we don't have the money, but the transition implies that now we have the money. So
// it's a disruptive transition and may be produced because of an error of sync or
// other type of error.
Transitionable.unsafeInvalidTransitionsToStatus = {
  chargedBack: [
    PaymentStatus.partialRefund,
    PaymentStatus.pendingAuthorize,
    PaymentStatus.authorized,
    PaymentStatus.creating,
    PaymentStatus.pendingCancel,
    PaymentStatus.pendingClientAction,
  ],
  cancelled: [
    PaymentStatus.creating,
  ],
  refunded: [
    PaymentStatus.pendingAuthorize,
    PaymentStatus.authorized,
    PaymentStatus.pendingClientAction,
    PaymentStatus.creating,
  ],
};

function isValidTransition(fromState, toState) {
  const toTransitions = Transitionable.validTransitions[fromState];
  return toTransitions && _.indexOf(toTransitions, toState) >= 0;
}

function isIgnorableTransition(fromState, toState) {
  const toTransitions = Transitionable.ignorableTransitions[fromState];
  return toTransitions && _.indexOf(toTransitions, toState) >= 0;
}

function doTransition(model, newStatus) {
  return knex.transaction((trx) => {
    return knex(model.tableName)
      .transacting(trx)
      .forUpdate()
      .where('id', model.get('id'))
      .first('status_id')
      .then((resp) => {
        const fromStatus = resp.status_id;

        if (!isValidTransition(fromStatus, newStatus)) {
          throw new errors.InvalidStateChangeError(fromStatus, newStatus);
        }

        return fromStatus;
      })
      .then((fromStatus) => {
        if (isIgnorableTransition(fromStatus, newStatus)) {
          return Promise.resolve(fromStatus);
        }

        return model.save({ status_id: newStatus }, { transacting: trx })
          .then(() => fromStatus);
      });
  });
}

Transitionable.prototype.canTransitionTo = function canTransitionTo(newState) {
  return isValidTransition(this.get('status_id'), newState);
};

Transitionable.prototype.shouldIgnoreTransitionTo = function shouldIgnoreTransitionTo(newState) {
  return isIgnorableTransition(this.get('status_id'), newState);
};

Transitionable.prototype.transitionTo = function transitionTo(newStatus, action) {
  const self = this;
  return doTransition(this, newStatus)
    .then((oldStatus) => {
      return action().catch((err) => {
        return self.set('status_id', oldStatus)
          .save()
          .catch((savingError) => {
            log.error('transitionable.transit_to.rollback_original_status.error', {
              model_id: self.get('id'),
              from_status: oldStatus,
              to_status: newStatus,
              error: savingError,
            });
          })
          .then(() => {
            throw err;
          });
      });
    });
};

module.exports = Transitionable;
