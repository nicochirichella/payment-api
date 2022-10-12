function Payment() {
    this.installments = null;
    this.amountInCents = null;
    this.interestInCents = null;
    this.paymentInformation = null;
    this.type = "paypal";
}

Payment.prototype.getConfig = function () {

    var deferred = $.Deferred();
    var tenant = getParameterByName('tenant');
    var env = getParameterByName('environment') || 'production';
    var baseUrl = ENVS[env][tenant];

    var self = this;
    $.ajax({
        method: "GET",
        url: baseUrl + '/api/v1/payment/payment-method-config/' + getParameterByName('paymentMethod'),
    })
        .then(function (data) {
            self.installmentsInformation = data.installments[0];
            self.installments = data.installments;
            deferred.resolve();
        })
        .catch(function (err) {
            console.error("There was an error fetching PAYPAL payment method configuration.");
            deferred.reject(err);
        });

    return deferred.promise();
};

Payment.prototype.formatForSend = function () {
    return {
        installments: null,
        amountInCents: this.amountInCents,
        interestInCents: 0,
        paymentInformation: this.paymentInformation,
        type: this.type
    };
};

Payment.prototype.isValid = function () {
    return (
    (this.amountInCents !== null) &&
    (this.type === "paypal") &&
    (this.installmentsInformation !== null))
};
