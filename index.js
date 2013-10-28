var ApiMiddleware = require('./lib/api-middleware');
var createApi = require('./lib/create-api.js');


//
// export hapi plugin register
//
module.exports.register = function(plugin, options, next) {

  if (typeof plugin.route !== 'function') {
    return next(new Error('Plugin requires route permission'));
  };

  function expose(scope, fnName) {
    plugin.expose(fnName, function() {
      scope[fnName].apply(scope, arguments);
    });
  }

  var api = new ApiMiddleware();
  expose(api, 'setHandler');
  expose(api, 'setPreHandler');
  expose(api, 'setPostHandler');

  createApi(plugin, api.baseHandlers, options, next);
};
