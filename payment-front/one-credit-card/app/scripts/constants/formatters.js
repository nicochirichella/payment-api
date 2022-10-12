'use strict';

var formatter = {
    MERCADOPAGO: "mercadopago",
    AYDEN: "ayden",
    CYBERSOURCE: "cybersource",
};

angular.module('oneCreditCardApp')
    .constant('FORMATTER', formatter);