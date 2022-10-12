var Payment = {

  id: "12233",

  clientOrderReference: "5ebb6400-9881-4274-9",
  clientPaymentReference: "ASfasfasfASf-232-4asfa-0",
  gatewayReference: "5ebb6400-9881-4274-9",
  gatewayMethod: "MUNDIPAGG_REDIRECT",

  status: "successfull",
  installments: 1,
  currency: "BRL",

  createdAt: "2015-11-13T00:00:00Z",
  updatedAt: "2015-11-13T00:00:00Z",

  shoppingCart: {
    items: [
      {
         name: "Nome do Produto de Teste",
         reference: "Referencia 121232",
         discountAmountInCents: 10,
         totalCostInCents: 112,
         unitCostInCents: 1223,
         quantity: 123
      }
    ],
    totalCostInCents: 1000
  },
  buyer: {
    reference: "A2B3C4",
    type: "person",
    name: "Alexandre B.",
    gender: "M",
    birthDate: "1990-01-29",
    documentNumber: "11111111111111",
    documentType: "CPF",
    email: "teste@teste.com",
    phone: "999999999",
    ipAddress: "192.168.0.100",
    billingAddress: {
      city: "Rio de Janeiro",
      district: "Centro",
      country: "Brazil",
      complement: "Teste de complemento",
      number: "12123",
      zipCode: "12123321",
      state: "Rio de Janeiro",
      stateCode: "RJ",
      street: "Rua de Teste"
    },
    shippingAddress: {
      city: "Rio de Janeiro",
      district: "Centro",
      country: "Brazil",
      complement: "Teste de complemento",
      number: "12123",
      zipCode: "12123321",
      state: "Rio de Janeiro",
      stateCode: "RJ",
      street: "Rua de Teste"
    }
  }
};

Payment.setStatus = function (newStatus) {
  this.status = newStatus;
  return this;
};

Payment.setclientPaymentReference = function (clientPaymentReference) {
  this.clientPaymentReference = clientPaymentReference;
  return this;
};

module.exports = Payment;
