var env = params.environment || 'production';
var baseUrl = ENVS[env][params.tenant]['baseUrl'];
var purchaseReference = params.purchaseReference;
var clientReference = params.clientReference;
var urls = {
    baseUrl: baseUrl,
    executeUrl: baseUrl + '/comprar/checkout/execute?hash='+ purchaseReference,
    checkoutUrl: baseUrl + '/comprar/checkout/information?h=' + purchaseReference
};

_kmq.push(['record', 'Paypal frontend shown', {
    purchaseReference: purchaseReference,
    email:  params.payerEmail
}]);


var ppp = PAYPAL.apps.PPP({
    "approvalUrl": decodeURIComponent(params.approvalUrl),
    "placeholder": "ppplusDiv",
    "mode": params.environment === "production" ? "live" : "sandbox",
    "payerFirstName": params.payerFirstName,
    "payerLastName": params.payerLastName ? params.payerLastName : params.payerFirstName,
    "payerEmail": params.payerEmail,
    "payerPhone": params.payerPhone,
    "payerTaxId": params.payerTaxId,
    "payerTaxIdType": params.payerTaxIdType,
    "language": params.language,
    "country": params.country,
    "enableContinue": "continueButton",
    "disableContinue": "continueButton",
    "merchantInstallmentSelection" : params.installments ? parseInt(params.installments) : 1,
    "merchantInstallmentSelectionOptional" : false,
});

function registerRejection(purchaseReference, clientReference, ppplusError) {
    $.ajax({
        url: baseUrl + '/api/v1/payment/register-rejection',
        type: 'post',
        crossDomain: true,
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({
            hash: purchaseReference,
            clientReference: clientReference,
            reason: ppplusError
        }),
        error: function (err) {
            console.error('paypal_cc_redirect.register_rejection.api_response_error', {
                error: err.responseJSON,
                purchaseReference: purchaseReference,
                clientReference: clientReference,
                reason: ppplusError
            });
        }
    })
}

function messageListener(event) {

    try {
        var message = JSON.parse(event.data);

        if (typeof message['cause'] !== 'undefined') {
            var ppplusError = message['cause'].replace(/['"]+/g, "");

            console.error('paypal_cc_redirect.frontend_error', {
                ppplusError: ppplusError
            });

            _kmq.push(['record', 'Paypal frontend credit card rejected', {
                purchaseReference: purchaseReference,
                email:  params.payerEmail,
                ppplusError: ppplusError
            }]);

            registerRejection(purchaseReference, clientReference, ppplusError);

            $(".overlay").hide();
            document.getElementById("iframe-container").scrollIntoView();

        }

        switch(message['action']) {
            case 'enableContinueButton':
                $(".overlay").hide();
                break;
            case 'disableContinueButton':
            case 'closeMiniBrowser':
                $(".overlay").show();
                break;
            case 'checkout':
                $(".overlay").show();
                var payerID = message['result']['payer']['payer_info']['payer_id'];

                _kmq.push(['record', 'Paypal frontend credit card accepted', {
                    purchaseReference: purchaseReference,
                    email:  params.payerEmail
                }]);

                window.location.href = urls.executeUrl + '&PayerID=' + payerID;
                break;
        }

    } catch (e) {
        console.log('Error', e);
        $(".overlay").hide();
    }
}

//Add Paypal event listener.

if (window.addEventListener) {
    window.addEventListener("message", messageListener, false);
} else if (window.attachEvent) {
    window.attachEvent("onmessage", messageListener);
} else {
    console.log("Could not attach message listener", "debug");
    throw new Error("Can't attach message listener");
}

//Translation language

function getLanguage() {
    var validLanguages = ['pt','es'];
    var selectedLanguage = params.language ? params.language.toLowerCase() : null;
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

function toFixed(num, fixed) {
    var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
    return num.toString().match(re)[0];
}

$('#link-return-to-checkout').attr("href", urls.checkoutUrl);
$('.product-title').text(decodeURIComponent(params.itemName));
$('.js-current-price-label').text(params.total);
$('.product-img').attr('src',decodeURIComponent(params.itemImageUrl));
$('.js-price-installments').text(params.installments);
$('.js-current-each-installment-price-label').text(toFixed((parseFloat(params.total) / params.installments), 2));
$( "#continueButton" ).click(function() {
    $(".overlay").show();
});
