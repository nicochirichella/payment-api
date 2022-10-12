var payment = new Payment();
var getConfigPromise = payment.getConfig().catch(function (err) {
    $('div#content').hide();
    $('.js-checkout-error-message').show();
    window.trocafone.auth.postToParent('height', getHeight());
    throw new Error();
});

function updateInstallments(payment) {
    if (!payment || !payment.installments || !payment.amountInCents) {
        return false;
    }

    var options = $(".js-installments-select");
    options.empty();
    $.each(payment.installments, function (index, installment) {
        if (Math.floor(Number(installment.interestPercentage)) === 0) {
            options.append($("<option />").val(index).text(this.installments + ' x  $' + Math.round(payment.amountInCents / installment.installments)/100 + ' sem juros'));
        } else {
            var totalWithInterest = payment.calculateTotalsFor(installment).total;
            options.append($("<option />").val(index).text(this.installments + ' x  $' + Math.round(totalWithInterest * 100 / installment.installments)/ 100 + ' (total R$' + totalWithInterest + ')'));
        }
    });
    if (payment.installmentsInformation && payment.installmentsInformation.installments) {
        options.val(payment.installmentsInformation.installments - 1);
    }
};

$(".js-installments-select").on('change', function() {
    if (payment.isValid()) {
        payment.installmentsInformation = payment.installments[$(this).val()];
        var formattedPayment = payment.formatForSend();
        window.trocafone.auth.postToParent('updatePaymentDiscountInfo', {interest: formattedPayment.interestInCents/100});
        window.trocafone.auth.postToParent('paymentData', {payments: [formattedPayment], passive: true});
    }
});

window.trocafone.auth.registerWindowListener('getPaymentData', function () {
    getConfigPromise.then(function () {
        window.trocafone.auth.postToParent('paymentData', {payments: [payment.formatForSend()], passive: false});
    }).catch(function () {
        window.trocafone.auth.postToParent('inputError');
    });
});

window.trocafone.auth.registerWindowListener('updateTotalPrice', function (data) {

    if (payment.amountInCents !== data.total * 100) {
        payment.amountInCents = data.total * 100;
        updateInstallments(payment);
        if (payment.isValid()) {
            var formattedPayment = payment.formatForSend();
            window.trocafone.auth.postToParent('paymentData', {payments: [formattedPayment], passive: true});
            window.trocafone.auth.postToParent('updatePaymentDiscountInfo', {interest: formattedPayment.interestInCents/100});
        }
    }
});

window.trocafone.auth.postToParent('height', getHeight());

function getLanguage() {
    var validLanguages = ['pt','es'];
    var selectedLanguage = getParameterByName('language') ? getParameterByName('language').toLowerCase() : null;
    if (validLanguages.indexOf(selectedLanguage) !== -1) {
        return selectedLanguage;
    } else {
        return 'pt';
    }
}

$.i18n.load(translations[getLanguage()]);
$('.translate').each(function () {
    this.innerHTML = $.i18n._(this.innerHTML);
});
window.trocafone.auth.postToParent('height', getHeight());