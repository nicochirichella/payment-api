var payment = new Payment();
var getConfigPromise = payment.getConfig().catch(function (err) {
    $('div#content').hide();
    $('.js-checkout-error-message').show();
    window.trocafone.auth.postToParent('height', getHeight());
    throw new Error();
});

window.trocafone.auth.registerWindowListener('getPaymentData', function () {
    getConfigPromise.then(function () {
        window.trocafone.auth.postToParent('paymentData', {payments: [payment.formatForSend()], passive: false});
    }).catch(function () {
        window.trocafone.auth.postToParent('inputError');
    });
});

window.trocafone.auth.registerWindowListener('updateTotalPrice', function (data) {
    payment.amountInCents = data.total * 100;
    if (payment.isValid()) {
        window.trocafone.auth.postToParent('paymentData', {payments: [payment.formatForSend()], passive: true});
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