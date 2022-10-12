function Payment() {
    this.installments = null;
    this.amountInCents = null;
    this.interestInCents = null;
    this.paymentInformation = null;
    this.type = "creditCard";
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
            var installments = data.processors[0].installments;
            self.installmentsInformation = installments[0];
            self.installments = installments;
            updateInstallments(self);
            deferred.resolve();
        })
        .catch(function (err) {
            console.error("There was an error fetching " + getParameterByName('paymentMethod') + " payment method configuration.");
            deferred.reject(err);
        });

    return deferred.promise();
};

Payment.prototype.formatForSend = function () {
    return {
        installments: this.installmentsInformation.installments,
        amountInCents: this.amountInCents,
        interestInCents: this.calculateInterest(this.installmentsInformation.interestPercentage),
        paymentInformation: this.paymentInformation,
        type: this.type,
        encryptedCreditCards: [
            {
                encryptedContent: "",
                encryptionType: "paypalCreditCard"
            }
        ]
    };
};

Payment.prototype.calculateInterest = function (interestPercentage) {
    var interestInCents = parseInt(Math.round(this.amountInCents * Number(interestPercentage) / 100));
    this.interestInCents = interestInCents;
    return interestInCents;
};

Payment.prototype.calculateTotalsFor = function(installments) {
    var total = this.amountInCents / 100;
    var discountPercentage = installments.interestPercentage;
    var interest = _.round(total * discountPercentage / 100, 2);

    return {
        total: _.round(total + interest, 2),
        discountPercentage: discountPercentage,
        interest: interest,
        totalWithoutInterest: total
    };
}

Payment.prototype.isValid = function () {
    return ((this.installments !== null) &&
    (this.amountInCents !== null) &&
    (this.type === "creditCard") &&
    (this.installmentsInformation !== null))
};
