module.exports = function executeResponseView(paymentOrder) {
  return paymentOrder.getRelation('validPayments').then((payments) => {
    return {
      redirectUrl: paymentOrder.getExecuteRedirectUrl(),
      statusDetails: payments.pluck('status_detail'),
      status: paymentOrder.get('status_id'),
    };
  });
};
