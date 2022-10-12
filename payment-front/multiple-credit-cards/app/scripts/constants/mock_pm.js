'use strict';

var response_two_credit_cards = {
    "processors": [{
        "id": "visa",
        "name": "Visa",
        "bin_regexp": {
            "pattern": "^(4)",
            "installments_pattern": "^(?!(453998|426398|462437|451212|456188))",
            "exclusion_pattern": "^(400163|400176|400178|400185|400199|404025|423808|439267|471233|473200|476332|482481|451416|438935|(40117[8-9])|(45763[1-2])|457393|431274)"
        },
        "card": {
            "length": 16,
            "mask": "9999 9999 9999 9999",
            "algorithm": "luhn"
        },
        "security_code": {
            "length": 3,
            "card_location": "back"
        },
        "logo_image": "https:\/\/payment-frontend.trocafone.com\/multiple-credit-cards\/images\/cards\/visa.gif",
        "installments": [{
            "installments": 1,
            "interestPercentage": "-5.00"
        }, {
            "installments": 2,
            "interestPercentage": "0.00"
        }, {
            "installments": 3,
            "interestPercentage": "0.00"
        }, {
            "installments": 4,
            "interestPercentage": "0.00"
        }, {
            "installments": 5,
            "interestPercentage": "0.00"
        }, {
            "installments": 6,
            "interestPercentage": "0.00"
        }, {
            "installments": 7,
            "interestPercentage": "0.00"
        }, {
            "installments": 8,
            "interestPercentage": "0.00"
        }, {
            "installments": 9,
            "interestPercentage": "0.00"
        }, {
            "installments": 10,
            "interestPercentage": "0.00"
        }, {
            "installments": 11,
            "interestPercentage": "0.00"
        }, {
            "installments": 12,
            "interestPercentage": "0.00"
        }],
        "metadata": {
            "mercadopagoId": "visa"
        }
    }, {
        "id": "mastercard",
        "name": "Mastercard",
        "bin_regexp": {
            "pattern": "^(5|(2(221|222|223|224|225|226|227|228|229|23|24|25|26|27|28|29|3|4|5|6|70|71|720)))",
            "installments_pattern": "^(?!(525823|525824|525834|527660|529133|529205|536390|513368|539131|529053|538450|538455|515675|549636|524886|546616|529115|511623|521580|527308|527648|528841|530551|533728|534300|539181|549622|528590|542865|538454|543299|545377))",
            "exclusion_pattern": "^(502121|506721|506722|506776|536969|589916|(50670[7-8])|(506715)|(50671[7-9])|(50672[0-1])|(50672[4-9])|(50673[0-3])|(506739)|(50674[0-8])|(50675[0-3])|(50677[4-8])|(50900[0-9])|(50901[3-9])|(50902[0-9])|(50903[1-5])|(50903[8-9])|(50904[0-9])|(50905[0-9])|(50906[0-4])|(50906[6-9])|(50907[0-2])|(50907[4-5])|(504175)|(50907[6-9])|(50908[0-9])|(509[0-7][0-9]{2})|(509[8]0[0-9])|(532884)|509810|506755)"
        },
        "card": {
            "length": 16,
            "mask": "9999 9999 9999 9999",
            "algorithm": "luhn"
        },
        "security_code": {
            "length": 3,
            "card_location": "back"
        },
        "logo_image": "https:\/\/payment-frontend.trocafone.com\/multiple-credit-cards\/images\/cards\/master.gif",
        "installments": [{
            "installments": 1,
            "interestPercentage": "-5.00"
        }, {
            "installments": 2,
            "interestPercentage": "0.00"
        }, {
            "installments": 3,
            "interestPercentage": "0.00"
        }, {
            "installments": 4,
            "interestPercentage": "0.00"
        }, {
            "installments": 5,
            "interestPercentage": "0.00"
        }, {
            "installments": 6,
            "interestPercentage": "0.00"
        }, {
            "installments": 7,
            "interestPercentage": "0.00"
        }, {
            "installments": 8,
            "interestPercentage": "0.00"
        }, {
            "installments": 9,
            "interestPercentage": "0.00"
        }, {
            "installments": 10,
            "interestPercentage": "0.00"
        }, {
            "installments": 11,
            "interestPercentage": "0.00"
        }, {
            "installments": 12,
            "interestPercentage": "0.00"
        }],
        "metadata": {
            "mercadopagoId": "master"
        }
    }, {
        "id": "elo",
        "name": "ELO (Cart\u00e3o de Cr\u00e9dito)",
        "bin_regexp": {
            "pattern": "^((50670[7-8])|506715|(50671[8-9])|(50672[0-1])|(50672[4-9])|(50673[0-3])|506739|(50674[1-3])|(50674[5-7])|506753|(50677[4-8])|(50900[0-2])|(50900[4-7])|509009|(50901[0-2])|509014|(50902[0-9])|509030|(50903[5-9])|(50904[0-2])|(50904[4-9])|(50905[0-9])|(50906[0-4])|(50906[6-9])|(50907[0-2])|(50907[4-9])|(50908[0-9])|(50909[1-2])|(50909[5-9])|(50910[0-1])|(50910[6-9])|(50911[0-9])|(50912[0-9])|(50913[0-9])|(50914[0-9])|(50915[0-9])|(50916[0-9])|(50917[0-9])|(50918[0-9])|(50919[0-9])|(50920[0-9])|(50921[0-9])|(50922[0-9])|(50923[0-9])|(50924[0-9])|(50925[0-9])|(50926[0-9])|(50927[0-9])|(50928[0-9])|(50929[0-9])|(50930[0-9])|(50931[0-9])|(50932[0-9])|(50933[0-9])|(50934[0-9])|(50935[0-9])|(50936[0-9])|(50937[0-9])|(50938[0-9])|(50939[0-9])|(50940[0-9])|(50941[0-9])|(50942[0-9])|(50943[0-9])|(50944[0-9])|(50945[0-9])|(50946[0-9])|(50947[0-9])|(50948[0-9])|(50949[0-9])|(50950[0-9])|(50951[0-9])|(50952[0-9])|(50953[0-9])|(50954[0-9])|(50955[0-9])|(50956[0-9])|(50957[0-9])|(50958[0-9])|(50959[0-9])|(50960[0-9])|(50961[0-9])|(50962[0-9])|(50963[0-9])|(50964[0-9])|(50965[0-9])|(50966[0-9])|(50967[0-9])|(50968[0-9])|(50969[0-9])|(50970[0-9])|(50971[0-9])|(50972[0-9])|(50973[0-9])|(50974[0-9])|(50975[0-9])|(50976[0-9])|(50977[0-9])|(50978[0-9])|(50979[0-9])|(50980[0-7])|(50983[1-9])|(50984[0-9])|(50985[0-9])|(50986[0-9])|(50987[0-7])|(50989[7-9])|509900|(50991[8-9])|(50992[0-9])|(50993[0-9])|(50994[0-9])|(50995[0-9])|(50996[0-4])|(50997[1-9])|(50998[0-6])|(50999[5-9])|636368|(65040[6-9])|(65041[0-9])|(65042[0-9])|(65043[0-9])|(65048[5-9])|(65049[0-9])|(65050[0-4])|(65050[6-9])|(65051[0-9])|(65052[0-9])|(65053[0-8])|(65055[2-9])|(65056[0-9])|(65057[0-9])|(65058[0-9])|(65059[0-8])|(65072[0-7])|(65090[1-9])|(65091[0-9])|(65092[0-2])|650928|650939|(65094[6-9])|(65095[0-9])|(65096[0-9])|(65097[0-8])|(65165[2-9])|(65166[0-9])|(65167[0-9])|(65168[0-9])|(65169[0-9])|(65170[0-4])|(65500[0-9])|(65501[0-9])|(65502[1-9])|(65503[0-9])|(65504[0-9])|(65505[0-7]))",
            "installments_pattern": "^(506718|(50672[0-1])|(50672[4-9])|(50673[0-3])|506739|(50674[1-3])|(50674[5-7])|506753|(50677[4-5])|(50677[7-8])|(50900[0-2])|(50900[4-7])|509009|509014|(50902[0-9])|509030|(50903[5-9])|(50904[0-2])|(50904[4-9])|(50905[0-3])|509064|(50906[6-9])|509072|(50907[4-9])|(50908[0-3])|(50908[5-6])|(50909[1-2])|(50909[5-9])|(50910[0-1])|(50910[7-9])|(50911[0-9])|(50912[0-9])|(50913[0-9])|(50914[0-9])|(50915[0-9])|(50916[0-9])|(50917[0-9])|(50918[0-9])|(50919[0-9])|(50920[0-9])|(50921[0-9])|(50922[0-9])|(50923[0-9])|(50924[0-9])|(50925[0-6])|(50950[7-9])|(50951[0-9])|(50952[0-9])|(50953[0-9])|(50954[0-9])|(50955[0-9])|(50956[0-9])|(50957[0-9])|(50958[0-9])|(50959[0-9])|(50960[0-9])|(50961[0-9])|(50962[0-9])|(50963[0-9])|(50964[0-9])|(50965[0-9])|(50966[0-9])|(50967[0-9])|(50968[0-9])|(50969[0-9])|(50970[0-9])|(50971[0-9])|(50972[0-9])|(50973[0-9])|(50974[0-9])|(50975[0-9])|(50976[0-9])|(50977[0-9])|(50978[0-9])|(50979[0-9])|(50980[0-7])|636368|(65048[5-9])|(65049[0-9])|(65050[0-4])|(65050[6-9])|(65051[0-3])|650516|(65051[8-9])|(65052[0-9])|(65053[0-8])|(65055[2-9])|(65056[0-9])|(65057[0-9])|(65058[0-9])|(65059[0-8])|(65072[0-7])|(65090[1-9])|(65091[0-9])|(65092[0-2])|650928|650939|(65094[6-9])|(65095[0-9])|(65096[0-9])|(65097[0-8])|(65165[2-9])|(65166[0-9])|(65167[0-9])|(65168[0-9])|(65169[0-9])|(65170[0-4])|(65500[0-9])|(65501[0-9])|(65502[1-9])|(65503[0-9])|(65504[0-9])|(65505[0-7]))",
            "exclusion_pattern": null
        },
        "card": {
            "length": 16,
            "mask": "9999 9999 9999 9999",
            "algorithm": "luhn"
        },
        "security_code": {
            "length": 3,
            "card_location": "back"
        },
        "logo_image": "https:\/\/payment-frontend.trocafone.com\/multiple-credit-cards\/images\/cards\/elo.gif",
        "installments": [{
            "installments": 1,
            "interestPercentage": "-5.00"
        }, {
            "installments": 2,
            "interestPercentage": "0.00"
        }, {
            "installments": 3,
            "interestPercentage": "0.00"
        }, {
            "installments": 4,
            "interestPercentage": "0.00"
        }, {
            "installments": 5,
            "interestPercentage": "0.00"
        }, {
            "installments": 6,
            "interestPercentage": "0.00"
        }, {
            "installments": 7,
            "interestPercentage": "0.00"
        }, {
            "installments": 8,
            "interestPercentage": "0.00"
        }, {
            "installments": 9,
            "interestPercentage": "0.00"
        }, {
            "installments": 10,
            "interestPercentage": "0.00"
        }, {
            "installments": 11,
            "interestPercentage": "0.00"
        }, {
            "installments": 12,
            "interestPercentage": "0.00"
        }],
        "metadata": {
            "mercadopagoId": "elo"
        }
    }, {
        "id": "diners",
        "name": "Diners",
        "bin_regexp": {
            "pattern": "^(36)",
            "installments_pattern": "^3",
            "exclusion_pattern": null
        },
        "card": {
            "length": 14,
            "mask": "9999 999999 9999",
            "algorithm": "luhn"
        },
        "security_code": {
            "length": 3,
            "card_location": "back"
        },
        "logo_image": "https:\/\/payment-frontend.trocafone.com\/multiple-credit-cards\/images\/cards\/diners.gif",
        "installments": [{
            "installments": 1,
            "interestPercentage": "-5.00"
        }, {
            "installments": 2,
            "interestPercentage": "0.00"
        }, {
            "installments": 3,
            "interestPercentage": "0.00"
        }, {
            "installments": 4,
            "interestPercentage": "0.00"
        }, {
            "installments": 5,
            "interestPercentage": "0.00"
        }, {
            "installments": 6,
            "interestPercentage": "0.00"
        }, {
            "installments": 7,
            "interestPercentage": "0.00"
        }, {
            "installments": 8,
            "interestPercentage": "0.00"
        }, {
            "installments": 9,
            "interestPercentage": "0.00"
        }, {
            "installments": 10,
            "interestPercentage": "0.00"
        }, {
            "installments": 11,
            "interestPercentage": "0.00"
        }, {
            "installments": 12,
            "interestPercentage": "0.00"
        }],
        "metadata": {
            "mercadopagoId": "diners"
        }
    }, {
        "id": "hipercard",
        "name": "Hipercard",
        "bin_regexp": {
            "pattern": "^((606282)|(637095)|(637568)|(637599)|(637609)|(637612))",
            "installments_pattern": "^((606282)|(637095)|(637568)|(637599)|(637609)|(637612))",
            "exclusion_pattern": null
        },
        "card": {
            "length": 16,
            "mask": "9999 9999 9999 9999",
            "algorithm": "luhn"
        },
        "security_code": {
            "length": 3,
            "card_location": "back"
        },
        "logo_image": "https:\/\/payment-frontend.trocafone.com\/multiple-credit-cards\/images\/cards\/hipercard.gif",
        "installments": [{
            "installments": 1,
            "interestPercentage": "-5.00"
        }, {
            "installments": 2,
            "interestPercentage": "0.00"
        }, {
            "installments": 3,
            "interestPercentage": "0.00"
        }, {
            "installments": 4,
            "interestPercentage": "0.00"
        }, {
            "installments": 5,
            "interestPercentage": "0.00"
        }, {
            "installments": 6,
            "interestPercentage": "0.00"
        }, {
            "installments": 7,
            "interestPercentage": "0.00"
        }, {
            "installments": 8,
            "interestPercentage": "0.00"
        }, {
            "installments": 9,
            "interestPercentage": "0.00"
        }, {
            "installments": 10,
            "interestPercentage": "0.00"
        }, {
            "installments": 11,
            "interestPercentage": "0.00"
        }, {
            "installments": 12,
            "interestPercentage": "0.00"
        }],
        "metadata": {
            "mercadopagoId": "hipercard"
        }
    }, {
        "id": "amex",
        "name": "American Express",
        "bin_regexp": {
            "pattern": "^((34)|(37))",
            "installments_pattern": "^(374758|374759|374760|374761|374762|374767|374768|374769|375130|375131|375132|375133|375134|375135|375136|375137|375138|375177|375178|376421|376422|376423|376424|376425|376426|376427|376428|376429|376440|376441|376442|376443|376444|376445|376446|376449|376461|376462|376463|376464|376465|376466|376467|376471|376472|376473|376474|376475|376476|376477|376478|376479|376480|376481|376482|376483|376484|376485|376486|376487|376488|376489|376491|376493|376520|376521|376522|376523|376524|376525|376526|376527|376528|376529|376619|376620|376621|376622|376623|376624|376625|376626|376627|376628|376629|377169|377174|379966|379967|379968)",
            "exclusion_pattern": "^((384100)|(384140)|(384160))"
        },
        "card": {
            "length": 15,
            "mask": "9999 9999999 9999",
            "algorithm": "luhn"
        },
        "security_code": {
            "length": 4,
            "card_location": "front"
        },
        "logo_image": "https:\/\/payment-frontend.trocafone.com\/multiple-credit-cards\/images\/cards\/amex.gif",
        "installments": [{
            "installments": 1,
            "interestPercentage": "-5.00"
        }, {
            "installments": 2,
            "interestPercentage": "0.00"
        }, {
            "installments": 3,
            "interestPercentage": "0.00"
        }, {
            "installments": 4,
            "interestPercentage": "0.00"
        }, {
            "installments": 5,
            "interestPercentage": "0.00"
        }, {
            "installments": 6,
            "interestPercentage": "0.00"
        }, {
            "installments": 7,
            "interestPercentage": "0.00"
        }, {
            "installments": 8,
            "interestPercentage": "0.00"
        }, {
            "installments": 9,
            "interestPercentage": "0.00"
        }, {
            "installments": 10,
            "interestPercentage": "0.00"
        }, {
            "installments": 11,
            "interestPercentage": "0.00"
        }, {
            "installments": 12,
            "interestPercentage": "0.00"
        }],
        "metadata": {
            "mercadopagoId": "amex"
        }
    }],
    "documentTypes": [{
        "name": "CPF",
        "mask": "999.999.999-99"
    }],
    "formatter": "mercadopago"
};

angular.module('multipleCreditCardsApp')
    .constant('RESPONSE_TWO_CREDIT_CARDS', response_two_credit_cards);