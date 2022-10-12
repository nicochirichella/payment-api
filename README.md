# Payment API

## Routes
```
Base route: /:tenant/v1/
```
    
```
GET  /methods
GET  /methods/:id

GET  /gateways
GET  /gateways/:id
POST /gateways/:id/ipn

GET  /payments/:id
POST /payments/:id/cancel
POST /payments/:id/charge-back
```
    
## Get all payment methods

```
GET /methods
```

###Example ret:

```json
[
    {
        "id": 666,
        "type": "MUNDIPAGG_REDIRECT",
        "name": "POC payment method",
        "enabled": true,
        "ui_url": "http://localhost:8181/front/poc"
    }
]
```


## Create a payment

```
POST /payments
```

###Example response:
```json
{
    "status": "ok"
}
```

## Dev init

Execute the script `dev_init.sh`
