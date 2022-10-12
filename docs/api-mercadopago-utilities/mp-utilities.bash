#!/bin/bash

PAYMENT_REFERENCE=''
mkdir -p tmp

out()
{
    local params
    local message

    params="-e"
    while [[ ${1} = -* ]]; do
        params="${params} ${1}"
        shift
    done

    message="${@}<0>"

    message=$(echo "${message}" | sed -E $'s/<([0-9;]+)>/\033\[\\1m/g')
    echo ${params} "${message}"
}


function getCardToken () {
    CARD_TOKEN=''
    out '
    <35;1>Getting card token...<0>
    '
    CARD_TOKEN=$(curl -X POST \
        -H 'accept: application/json' \
        -H 'content-type: application/json' \
        'https://api.mercadopago.com/v1/card_tokens?public_key=APP_USR-3812525c-f74b-4b2e-9c76-e83dc3949013'\
        -d @templates/card-token.json | jq '.id')
    out '
<32;1>Token recieved was '${CARD_TOKEN}'<0>
'
}

function getRandomPaymentReference() {
    PAYMENT_REFERENCE=\"MP-$RANDOM\"
}

function createPayment () {
    CARD_TOKEN='unset'
    getCardToken
    out '<35;1>Attempting to create payment...<0>
    '
    getRandomPaymentReference
    sed \
    -e "s/\"{CARD_TOKEN}\"/${CARD_TOKEN}/" \
    -e "s/\"{PAYMENT_REFERENCE}\"/${PAYMENT_REFERENCE}/" \
    templates/create-payment.json > ./tmp/create-payment.json

    MP_CREATE_PAYMENT_RESPONSE=$(curl -X POST \
        --insecure \
        -H 'accept: application/json' \
        -H 'content-type: application/json' \
        -H "X-Api-Key: f6981d1b-5619-456f-ab29-3d17c4e85026" \
        'https://payment.trocafone.local:8443/ec_br/v1/payments/' \
        -d @tmp/create-payment.json)
    out '
<32;1>Server response was 
'${MP_CREATE_PAYMENT_RESPONSE}'<0>'
}

function help() {
    out '
<33>Mercadopago utilities base:<0>
<35>Interactions with Mercadopago API:<0>
  <32;1>-c | --get-card-token<0>      Get credit card token from MP and prints it to console.<0>
  <32;1>-g | --create-payment<0>      Creates a mercadopago payment.<0>

'
}

function run () {
    case $1 in
        -g|--get-card-token)
            getCardToken
            exit 0
        ;;
        -c|--create-payment)
            createPayment
            exit 0
        ;;

        *)
            help
            out "<33;1>Please choose one of the methods above.<0>"
        ;;
    esac
}

run $1

