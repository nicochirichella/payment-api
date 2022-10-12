var _ = require("lodash");
var Methods = require("../models/methods");


module.exports =  {
  getMethods: function (transactionId) {
    return {
      "httpRequest": {
        "method": "GET",
        "path": "/ecommerce/v1/methods"
      },
      "httpResponse": {
        "statusCode": 200,
        "body": JSON.stringify( Methods )
      },
      'times': {
            //'remainingTimes': 1,
            'unlimited': true
        }
    };
  },
};
