var Cores = require('cores');
var Middleware = require('./lib/middleware');
var createRoutes = require('./lib/create-routes.js');
var Common = require('./lib/common.js');


//
// hapi plugin
//
module.exports.register = function(plugin, options, next) {

  var selection = plugin;
  if (options.selection) {
    selection = plugin.select(options.selection);
  }

  if (!options.dbUrl) {
    return next(new Error('No database url specified'));
  }
  if (!options.resourceDir) {
    return next(new Error('No resource directory specified'));
  }

  Common.debug = options.debug;

  var cores;

  Cores(options.dbUrl).then(function(c) {
    cores = c;
    return cores.load(options.resourceDir, options.context, options.syncDesign);

  }).then(function(resources) {
    Object.keys(resources).forEach(function(name) {
      plugin.log(['cores-hapi'], 'loaded resource ' + name);
    });

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

  }).fail(function(err) {
    next(err);
  });
};
