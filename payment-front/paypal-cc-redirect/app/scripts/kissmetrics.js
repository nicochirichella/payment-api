var env = getParameterByName('environment') || 'production';
var _kmq = _kmq || [];
var _kmk = _kmk || ENVS[env]['ec_br']['kmKey'];

function _kms(u){
    setTimeout(function(){
        var d = document, f = d.getElementsByTagName('script')[0], s = d.createElement('script');
        s.type = 'text/javascript'; s.async = true; s.src = u;
        f.parentNode.insertBefore(s, f);
    }, 1);
}
_kms('//i.kissmetrics.com/i.js');
_kms('//scripts.kissmetrics.com/' + _kmk + '.2.js');