var Payment = {

  id: "12233",
  tenantReference: "5ebb6400-9881-4274-9",
  gatewayReference: "5ebb6400-9881-4274-9",
  gatewayMethod: "1TCMundiPagg",

  status: "successfull",
  type: "creditCard",
  installments: 1,

  createdAt: "2015-11-13T00:00:00.000Z",
  updatedAt: "2015-11-13T00:00:00.000Z",

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
    type: "Person",
    name: "Alexandre B.",
    gender: "M",
    birthDate: "2005-01-29T16:12:36",
    documentNumber: "11111111111111",
    documentType: "CPF",
    email: "teste@teste.com",
    phone: "(21) 99999-9999",
    ipAddress: "192.168.0.100",
    billingAddress: {
      city: "Rio de Janeiro",
      district: "Centro",
      country: "Brazil",
      complement: "Teste de complemento",
      number: "12123",
      zipCode: "12123-321",
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
      zipCode: "12123-321",
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

module.exports = Payment;
