'use strict';

angular.module('oneCreditCardApp')
  .service('CybersourceScript', function ($window, $document, $q, configService, FORMATTER) {

      var deviceFingerprintId = null;
      return {
          loadScript: function(hash) {
              var keys = configService.getApiKeyForGateway(FORMATTER.CYBERSOURCE);
              deviceFingerprintId = hash;
              var sessionId = keys.merchant_id + hash;
              var deviceFingerprintUrl = 'https://h.online-metrix.net/fp/tags.js?org_id='
                  + keys.metrix_company_id
                  +'&session_id=' + sessionId;

              if (!document.getElementById('cybersource-script')) {
                  var $script = document.createElement('script');
                  $script.src = deviceFingerprintUrl;
                  $script.id = 'cybersource-script';
                  document.body.appendChild($script);
              }
          },
          getDeviceFingerprintId: function() {
              return deviceFingerprintId;
          }
      }

  });
