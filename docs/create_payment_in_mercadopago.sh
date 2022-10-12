CARD_TOKEN=$(curl -X POST \
        -H 'accept: application/json' \
        -H 'content-type: application/json' \
        'https://api.mercadopago.com/v1/card_tokens?public_key=APP_USR-3812525c-f74b-4b2e-9c76-e83dc3949013'\
        -d '{
            "card_number": "4235647728025682",
            "cardholder": {
                "name": "APRO",
                "identification": {
                    "type": "CPF",
                    "number": "66505311971"
                }
            },
            "expiration_month": 2,
            "expiration_year": 2019,
            "security_code": "123"
        }'|jq '.id')

echo $CARD_TOKEN
curl -X POST \
        -H 'accept: application/json' \
        -H 'content-type: application/json' \
        'https://api.mercadopago.com/v1/payments?access_token=APP_USR-1741271916019417-082810-96572e513aaf64826f68dddc691fe7b9__LD_LA__-185370551' \
        -d '{
                "transaction_amount": 1000,
                "payment_method_id": "visa",
                "token": '$CARD_TOKEN',
                "description": "Title of what you are paying for",
                "payer": {
                    "email": "test_user_29505388@testuser.com"
                },
                "installments": 1,
                "external_reference": "Su ID Interno",
                "statement_descriptor": "TROCAFONE",
                "capture": true, // Si lo mandan en false, se generará una autorización. True es el default.
                "binary_mode": false,
                "additional_info": {
                    "items": [{
                        "id": "item-ID-1234",
                        "title": "Motorola Moto G",
                        "picture_url": "https://www.mercadopago.com/org-img/MP3/home/logomp3.gif",
                        "description": "Compra de telefono Moto G",
                        "category_id": "phones",
                        "quantity": 1,
                        "unit_price": 100
                    }],
                    "shipments": {
                        "receiver_address": {
                            "zip_code": "22615",
                            "street_number": 123,
                            "street_name": "Street",
                            "apartment": "La ultima casa a la derecha piso 4" // complemento
                        }
                    },
                    "payer": {
                        "first_name": "alan",
                        "last_name": "capo",
                        "registration_date": "2015-06-02T12:58:41.425-04:00",
                        "phone": {
                            "number": "4444aasd12424444"
                        },
                        "address": {
                            "street_name": "Street",
                            "street_number": 123,
                            "zip_code": "22615"
                        }
                    }
                }
            }'