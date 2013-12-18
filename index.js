var Cores = require('cores');
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

  var cores = Cores(options.db);
  if (!options.resourcesDir) {
    return next(new Error('No resources directory specified'));
  }
  cores.load(options.resourcesDir, options.syncDesign).then(function(resources) {

    plugin.expose('cores', cores);

    if (options.api) {
      var api = new ApiMiddleware();
      expose(api, 'setHandler');
      expose(api, 'setPreHandler');
      expose(api, 'setPostHandler');

      createApi(plugin, cores, api.baseHandlers, options.api, next);
    }
    else {
      next();
    }
  }, function(err) {
    next(err);
  });
};
