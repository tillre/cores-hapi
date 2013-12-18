var Cores = require('cores');
var ApiMiddleware = require('./lib/api-middleware');
var createApi = require('./lib/create-api.js');


//
// export hapi plugin register
//
module.exports.register = function(plugin, options, next) {

  plugin.log(['cores-hapi'], 'register');
  var selection = plugin;
  if (options.selection) {
    selection = plugin.select(options.selection);
  }

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

      try {
        createApi(selection, cores, api.baseHandlers, options.api, next);
      }
      catch(e) {
        next(e);
      }
    }
    else {
      try {
        next();
      }
      catch(e) {
        next(e);
      }
    }
  }, function(err) {
    next(err);
  });
};
