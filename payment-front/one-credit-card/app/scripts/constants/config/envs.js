'use strict';

var config = {
    local: {
        ec_br: {
            url: 'https://www.trocafone.local',
            gateways: {
                mercadopago: 'APP_USR-3812525c-f74b-4b2e-9c76-e83dc3949013',
                adyen: {
                    key: "10001|B9A7C70D8E99C4FCDD164103598E10210DC7E63575A6FD12056BA5B9806F12A836DBD5F4A8E5869AFC5D48164DBB7945F0980893B6178F2BDF21C8539172AB06E055E1EA36D6CB1C72BC670EB8AB5084D70F4006E78CD52AE6EF2B78B345B83B910507EA5C488C864054C8C85A93EE9DE2EFF4DB55954A29F2C0B3E1B2A2D805FDFAA724DB00289BD03723AD2B56FA4D2A503AB0673EF5984B447DDDC652229ECBC95CAAF3EEF398D4D3C1180058A103737C94EDA14347B29FD7887E20A2E3B47CDEB89212CEF04399F0F2A07415DF1FDC7BDB98F97A1CA6A715FEF6502F8F41BE3AF5DD9538482E77CC42ABF5B20723D8537EDC0822CF716D28DAF3F642D61B",
                    id: '1114752617822091'
                },
                cybersource: {
                    token_url: 'https://testflex.cybersource.com/cybersource/flex/v1/tokens',
                    metrix_company_id: "1snn5n9w",
                    merchant_id: "trocafone_br",
                },
            }
        },
        tv_br: {
            url: 'https://www.trocafone.local',
            gateways: {
                mercadopago: 'TEST-e520c340-d4c4-478f-8c54-7f924f31513b',
                cybersource: {
                    token_url: 'https://testflex.cybersource.com/cybersource/flex/v1/tokens',
                    metrix_company_id: "1snn5n9w",
                    merchant_id: "trocafone_br",
                },
            },
        },
    },
    staging: {
        ec_br: {
            url: 'https://staging.trocafone.com',
            gateways: {
                mercadopago: 'APP_USR-b10ad61f-7dd9-4117-a906-03a662182514',
                adyen: {
                    key: "10001|B9A7C70D8E99C4FCDD164103598E10210DC7E63575A6FD12056BA5B9806F12A836DBD5F4A8E5869AFC5D48164DBB7945F0980893B6178F2BDF21C8539172AB06E055E1EA36D6CB1C72BC670EB8AB5084D70F4006E78CD52AE6EF2B78B345B83B910507EA5C488C864054C8C85A93EE9DE2EFF4DB55954A29F2C0B3E1B2A2D805FDFAA724DB00289BD03723AD2B56FA4D2A503AB0673EF5984B447DDDC652229ECBC95CAAF3EEF398D4D3C1180058A103737C94EDA14347B29FD7887E20A2E3B47CDEB89212CEF04399F0F2A07415DF1FDC7BDB98F97A1CA6A715FEF6502F8F41BE3AF5DD9538482E77CC42ABF5B20723D8537EDC0822CF716D28DAF3F642D61B",
                    id: '1114752617822091'
                },
                cybersource: {
                    token_url: 'https://testflex.cybersource.com/cybersource/flex/v1/tokens',
                    metrix_company_id: "1snn5n9w",
                    merchant_id: "trocafone_br",
                },
            }
        },
        tv_br: {
            url: 'https://staging.trocafone.com',
            gateways: {
                'mercadopago': 'TEST-e520c340-d4c4-478f-8c54-7f924f31513b',
                cybersource: {
                    token_url: 'https://testflex.cybersource.com/cybersource/flex/v1/tokens',
                    metrix_company_id: "1snn5n9w",
                    merchant_id: "trocafone_br",
                },
            },
        },
        ec_br_pombo: {
            url: 'https://pombo.stg.trocafone.net',
            gateways: {
                mercadopago: 'APP_USR-b10ad61f-7dd9-4117-a906-03a662182514',
                adyen: {},
                cybersource: {
                    token_url: 'https://testflex.cybersource.com/cybersource/flex/v1/tokens',
                    metrix_company_id: "1snn5n9w",
                    merchant_id: "trocafone_br",
                },
            }
        },
    },
    production: {
        tv_br: {
            url: 'https://www.trocafone.com',
            gateways: {
                mercadopago: 'APP_USR-22e52f1e-0c50-4772-b59e-1fd76f200fad',
                cybersource: {
                    token_url: 'https://flex.cybersource.com/cybersource/flex/v1/tokens',
                    metrix_company_id: "k8vif92e",
                    merchant_id: "trocafone_br",
                }
            },
        },
        ec_br: {
            url: 'https://www.trocafone.com',
            gateways: {
                mercadopago: 'APP_USR-6f10aa61-a8e7-41c5-8343-28a32a2ad2ea',
                adyen: {},
                cybersource: {
                    token_url: 'https://flex.cybersource.com/cybersource/flex/v1/tokens',
                    metrix_company_id: "k8vif92e",
                    merchant_id: "trocafone_br",
                },
            }
        },
    },
};

angular.module('oneCreditCardApp')
    .constant('ENVS', config);
