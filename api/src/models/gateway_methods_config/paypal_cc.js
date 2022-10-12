
function processors(installments) {
  /* eslint-disable max-len */
  return [
    {
      id: 'visa',
      name: 'Visa',
      bin_regexp: {
        pattern: '^(4)',
        installments_pattern: '^(?!(453998|426398|462437|451212|456188))',
        exclusion_pattern: '^((451416)|(438935)|(40117[8-9])|(45763[1-2])|(457393)|(431274)|(402934))',
      },
      card: {
        length: 16,
        mask: '9999 9999 9999 9999',
        algorithm: 'luhn',
      },
      security_code: {
        length: 3,
        card_location: 'back',
      },
      logo_image: 'https://payment-frontend.trocafone.com/multiple-credit-cards/images/cards/visa.gif',
      installments,
      metadata: {
        mercadopagoId: 'visa',
      },
    },
    {
      id: 'mastercard',
      name: 'Mastercard',
      bin_regexp: {
        pattern: '^(5|(2(221|222|223|224|225|226|227|228|229|23|24|25|26|27|28|29|3|4|5|6|70|71|720)))',
        installments_pattern: '^(?!(525823|525824|525834|527660|529133|529205|536390|513368|539131|529053|538450|538455|515675|549636|524886|546616|529115|511623|521580|527308|527648|528841|530551|533728|534300|539181|549622))',
        exclusion_pattern: '^((50670[7-8])|(506715)|(50671[7-9])|(50672[0-1])|(50672[4-9])|(50673[0-3])|(506739)|(50674[0-8])|(50675[0-3])|(50677[4-8])|(50900[0-9])|(50901[3-9])|(50902[0-9])|(50903[1-5])|(50903[8-9])|(50904[0-9])|(50905[0-9])|(50906[0-4])|(50906[6-9])|(50907[0-2])|(50907[4-5])|(504175)|(50907[6-9])|(50908[0-9])|(530032)|(522499)|(509[0-7][0-9]{2})|(509[8]0[0-9])|509810)',
      },
      card: {
        length: 16,
        mask: '9999 9999 9999 9999',
        algorithm: 'luhn',
      },
      security_code: {
        length: 3,
        card_location: 'back',
      },
      logo_image: 'https://payment-frontend.trocafone.com/multiple-credit-cards/images/cards/master.gif',
      installments,
      metadata: {
        mercadopagoId: 'master',
      },
    },
    {
      id: 'elo',
      name: 'ELO (Cartão de Crédito)',
      bin_regexp: {
        pattern: '^((509091)|(636368)|(636297)|(504175)|(438935)|(40117[8-9])|(45763[1-2])|(457393)|(431274)|(50990[0-2])|(5099[7-9][0-9])|(50996[4-9])|(509[1-8][0-9][0-9])|(5090(0[0-2]|0[4-9]|1[2-9]|[24589][0-9]|3[1-9]|6[0-46-9]|7[0-24-9]))|(5067(0[0-24-8]|1[0-24-9]|2[014-9]|3[0-379]|4[0-9]|5[0-3]|6[0-5]|7[0-8]))|(6504(0[5-9]|1[0-9]|2[0-9]|3[0-9]))|(6504(8[5-9]|9[0-9])|6505(0[0-9]|1[0-9]|2[0-9]|3[0-8]))|(6505(4[1-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-8]))|(6507(0[0-9]|1[0-8]))|(65072[0-7])|(6509(0[1-9]|1[0-9]|20))|(6516(5[2-9]|6[0-9]|7[0-9]))|(6550(0[0-9]|1[0-9]))|(6550(2[1-9]|3[0-9]|4[0-9]|5[0-8])))',
        installments_pattern: '^((509091)|(636368)|(636297)|(504175)|(438935)|(40117[8-9])|(45763[1-2])|(457393)|(431274)|(50990[0-2])|(5099[7-9][0-9])|(50996[4-9])|(509[1-8][0-9][0-9])|(5090(0[0-2]|0[4-9]|1[2-9]|[24589][0-9]|3[1-9]|6[0-46-9]|7[0-24-9]))|(5067(0[0-24-8]|1[0-24-9]|2[014-9]|3[0-379]|4[0-9]|5[0-3]|6[0-5]|7[0-8]))|(6504(0[5-9]|1[0-9]|2[0-9]|3[0-9]))|(6504(8[5-9]|9[0-9])|6505(0[0-9]|1[0-9]|2[0-9]|3[0-8]))|(6505(4[1-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-8]))|(6507(0[0-9]|1[0-8]))|(65072[0-7])|(6509(0[1-9]|1[0-9]|20))|(6516(5[2-9]|6[0-9]|7[0-9]))|(6550(0[0-9]|1[0-9]))|(6550(2[1-9]|3[0-9]|4[0-9]|5[0-8])))',
        exclusion_pattern: null,
      },
      card: {
        length: 16,
        mask: '9999 9999 9999 9999',
        algorithm: 'luhn',
      },
      security_code: {
        length: 3,
        card_location: 'back',
      },
      logo_image: 'https://payment-frontend.trocafone.com/multiple-credit-cards/images/cards/elo.gif',
      installments,
      metadata: {
        mercadopagoId: 'elo',
      },
    },
    {
      id: 'diners',
      name: 'Diners',
      bin_regexp: {
        pattern: '^(36)',
        installments_pattern: '^3',
        exclusion_pattern: null,
      },
      card: {
        length: 14,
        mask: '9999 999999 9999',
        algorithm: 'luhn',
      },
      security_code: {
        length: 3,
        card_location: 'back',
      },
      logo_image: 'https://payment-frontend.trocafone.com/multiple-credit-cards/images/cards/diners.gif',
      installments,
      metadata: {
        mercadopagoId: 'diners',
      },
    },
    {
      id: 'hipercard',
      name: 'Hipercard',
      bin_regexp: {
        pattern: '^((606282)|(637095)|(637568)|(637599)|(637609)|(637612))',
        installments_pattern: '^((606282)|(637095)|(637568)|(637599)|(637609)|(637612))',
        exclusion_pattern: null,
      },
      card: {
        length: 16,
        mask: '9999 9999 9999 9999',
        algorithm: 'luhn',
      },
      security_code: {
        length: 3,
        card_location: 'back',
      },
      logo_image: 'https://payment-frontend.trocafone.com/multiple-credit-cards/images/cards/hipercard.gif',
      installments,
      metadata: {
        mercadopagoId: 'hipercard',
      },
    },
    {
      id: 'amex',
      name: 'American Express',
      bin_regexp: {
        pattern: '^((34)|(37))',
        installments_pattern: '^((374728)|(374731)|(374758)|(37513[0-9])|(37517[7-9])|(375180)|(37642[0-9])|(376430)|(37644[0-9])|(37646[1-7])|(37647[0-9])|(37648[0-9])|(37649[1-4])|(376498)|(376520)|(3765[40-99])|(376600)|(376603)|(376605)|(376610)|(37661[2-4])|(37661[6-9])|(376619)|(37662[0-9])|(377169)|(377174)|(37996[6-8]))',
        exclusion_pattern: '^((384100)|(384140)|(384160))',
      },
      card: {
        length: 15,
        mask: '9999 9999999 9999',
        algorithm: 'luhn',
      },
      security_code: {
        length: 4,
        card_location: 'front',
      },
      logo_image: 'https://payment-frontend.trocafone.com/multiple-credit-cards/images/cards/amex.gif',
      installments,
      metadata: {
        mercadopagoId: 'amex',
      },
    },
  ];
  /* eslint-enable max-len */
}

const documentTypes = [
  {
    name: 'CPF',
    mask: '999.999.999-99',
  },
];

module.exports = {
  getData(installmentsInfo) {
    return {
      processors: processors(installmentsInfo),
      documentTypes,
      formatter: 'mercadopago', // On purpose in case we change from PayPal to MP
    };
  },
};
