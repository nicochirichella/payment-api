function Payment() {
    this.installments = null;
    this.amountInCents = null;
    this.interestInCents = null;
    this.paymentInformation = null;
    this.type = "ticket";
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
            self.installments = data.installments[0].installments;
            deferred.resolve();
        })
        .catch(function (err) {
            console.error("There was an error fetching TICKET payment method configuration. Using local configuration");
            var configMock = {"installments":[{"installments":1,"interestPercentage":"0.00"}]};
            self.installmentsInformation = configMock.installments[0];
            self.installments = configMock.installments[0].installments;
            deferred.resolve();
        });

    return deferred.promise();
};

Payment.prototype.formatForSend = function () {
    return {
        installments: this.installmentsInformation.installments,
        amountInCents: this.amountInCents,
        interestInCents: this.calculateInterest(this.installmentsInformation.interestPercentage),
        paymentInformation: this.paymentInformation,
        type: this.type
    };
};

Payment.prototype.calculateInterest = function (interestPercentage) {
    var interestInCents = parseInt(Math.round(this.amountInCents * Number(interestPercentage) / 100));
    this.interestInCents = interestInCents;
    return interestInCents;
};

Payment.prototype.isValid = function () {
    return ((this.installments !== null) &&
    (this.amountInCents !== null) &&
    (this.type === "ticket") &&
    (this.installmentsInformation !== null))
};
