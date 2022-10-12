'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.ProcessorModel
 * @description
 * # ProcessorModel
 * ProcessorModel class in the oneCreditCardApp.
 */
angular.module('oneCreditCardApp')
  .factory('ProcessorModel', function () {
    function ProcessorModel(attrs) {
        _.assign(this, attrs);
    }

    ProcessorModel.prototype.match = function(bin) {
        return !bin.match(this.bin_regexp.exclusion_pattern) && bin.match(this.bin_regexp.pattern);
    };

    ProcessorModel.prototype.hasInstallments = function(bin) {
        return this.match(bin) && bin.match(this.bin_regexp.installments_pattern);
    };

    ProcessorModel.prototype.securityCodeLength = function() {
        return this.security_code.length;
    };

    ProcessorModel.prototype.isSecurityCodeOnFront = function() {
        return this.security_code.card_location == 'front';
    };

    ProcessorModel.prototype.cardLength = function() {
        return this.card.length;
    };

    ProcessorModel.prototype.cardMask = function() {
        return this.card.mask;
    };

    ProcessorModel.prototype.checkAlgorithm = function() {
        return this.card.algorithm;
    };

    ProcessorModel.prototype.toJSON = function() {
        return this.id;
    };

    return ProcessorModel;
});
