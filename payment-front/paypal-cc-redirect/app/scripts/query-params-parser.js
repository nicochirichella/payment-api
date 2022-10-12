function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

var params = {
    tenant: getParameterByName('tenant'),
    purchaseReference: getParameterByName('purchaseReference'),
    payerFirstName: getParameterByName('payerFirstName'),
    installments: getParameterByName('installments'),
    clientReference: getParameterByName('clientReference'),
    itemName: getParameterByName('itemName'),
    payerTaxIdType: getParameterByName('payerTaxIdType'),
    country: getParameterByName('country'),
    approvalUrl: getParameterByName('approvalUrl'),
    payerEmail: getParameterByName('payerEmail'),
    language: getParameterByName('language'),
    environment: getParameterByName('environment'),
    payerPhone: getParameterByName('payerPhone'),
    payerLastName: getParameterByName('payerLastName'),
    payerTaxId: getParameterByName('payerTaxId'),
    itemImageUrl: getParameterByName('itemImageUrl'),
    total: getParameterByName('total')
}