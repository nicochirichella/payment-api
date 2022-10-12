// Creación del módulo
var app = angular.module('paymentApp', ['ui.router']);

app.config(function($stateProvider, $urlRouterProvider) {

	$urlRouterProvider.otherwise("/index");

	$stateProvider
		.state('list', {
			url: "/index",
			templateUrl: "components/payments/views/list.html",
			controller: 'paymentsController'
		});
});

app.constant('AUTH_API', 'backoffice.trocafone.com/backoffice/api-auth/validate-token');
app.constant('PAYMENTS_API', 'https://assafas.com/v1/');
app.constant('LOGIN_URL', 'https://google.com');

app.controller('mainController', function($scope, auth) {
		auth.authOrRedirect();

		$scope.message = 'Hola, MAIN';

		$scope.authenticated = auth.isAuthed();
});

app.controller('paymentsController', function($scope) {
		$scope.message = 'Hola, Backoffice';
});


app.factory('auth', function($http, $window, $state, $location, LOGIN_URL){
	var auth = {};

	function parseJwt(token) {
		try {
		  var base64Url = token.split('.')[1];
		  var base64 = base64Url.replace('-', '+').replace('_', '/');
		  return JSON.parse($window.atob(base64));
		}
		catch (e) {
			return null;
		}
	}

	function tokenIsValid(token) {
		if (token) {
			var tokenData = parseJwt(token);
			if (tokenData){
				var isNotExpired = Math.round(new Date().getTime() / 1000) <= tokenData.exp;
				return isNotExpired
			}
		}
	}

	function setUrlToken() {
		var token = $location.search().token;

		if (!tokenIsValid(token)) {
			return;
		}

		if (auth.isAuthed()) {
			updateToken(token);
		}
		else {
			auth.clearToken();
			if (token) {
				auth.setToken(token);
			}
		}
	}

	function updateToken(newToken){
		var oldToken = auth.getToken();
		if (newToken && oldToken != newToken) {
			var oldData = parseJwt(oldToken);
			var newData = parseJwt(newToken);
			if (newData && oldData && newData.exp && oldData.exp && newData.exp > oldData.exp) {
				auth.setToken(newToken);
			}
		} 
	}

	function redirectToLogin(){
		auth.clearToken();
		console.log('Redirect to login!');
		$window.top.location.href = LOGIN_URL;
	}

	auth.getToken = function() {
		return $window.localStorage['jwtToken'];
	};

	auth.setToken = function(token) {
		$window.localStorage['jwtToken'] = token;
	};

	auth.clearToken = function() {
		$window.localStorage['jwtToken'] = null;
	}

	auth.authOrRedirect = function() {
		if (!auth.isAuthed()) {
			auth.clearToken();
			redirectToLogin();
		}
	}

	auth.isAuthed = function() {
		var token = auth.getToken();
		if(token) {
			var valid = tokenIsValid(token);
			if (valid) {
				return true;
			}
		}
		
		auth.clearToken();
		return false;
	};

	setUrlToken();
	return auth;
});

app.factory('authInterceptor', function (auth, PAYMENTS_API) {
	return {
		request: function(config) {
		  var token = auth.getToken();
		  if(config.url.indexOf(PAYMENTS_API) === 0 && token) {
		    config.headers.Authorization = 'Bearer ' + token;
		  }

		  return config;
		}
	}
})