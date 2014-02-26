var Cores = require('cores');
var Middleware = require('./lib/middleware');
var createRoutes = require('./lib/create-routes.js');


//
// hapi plugin
//
module.exports.register = function(plugin, options, next) {

  var selection = plugin;
  if (options.selection) {
    selection = plugin.select(options.selection);
  }

  var cores = Cores(options.db);

  if (!options.resourcesDir) {
    return next(new Error('No resources directory specified'));
  }
  cores.load(options.resourcesDir, options.syncDesign).then(function(resources) {

    plugin.expose('cores', cores);

    if (options.api) {
      var pre = new Middleware();
      var post = new Middleware();
      plugin.expose('pre', pre);
      plugin.expose('post', post);

      try {
        createRoutes(selection, cores, pre, post, options.api, function() {
          plugin.log(['cores-hapi'], 'initialized with api');
          next();
        });
      }
      catch(e) {
        next(e);
      }
    }
    else {
      try {
        plugin.log(['cores-hapi'], 'initialized without api');
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
