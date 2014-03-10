var Cores = require('cores');
var Common = require('./lib/common.js');
var createApi = require('./lib/create-api.js');

//
// hapi plugin
//
module.exports.register = function(plugin, options, next) {

  // var selection = plugin;
  // if (options.selection) {
  //   selection = plugin.select(options.selection);
  // }

  if (!options.dbUrl) {
    return next(new Error('No database url specified'));
  }
  // if (!options.resourceDir) {
  //   return next(new Error('No resource directory specified'));
  // }

  Common.debug = options.debug;

  var cores = Cores(options.dbUrl);

  // make sure db is there
  cores.info().then(function(info) {
    // return cores.load(options.resourceDir, options.context, options.syncDesign);
    // }).then(function(resources) {
    // Object.keys(resources).forEach(function(name) {
    //   plugin.log(['cores-hapi'], 'loaded resource ' + name);
    // });

    plugin.expose('cores', cores);
    plugin.expose('createApi', function(apiOptions) {
      // create rest routes
      createApi(plugin, cores, apiOptions);
    });

    try {
      next();
    }
    catch(e) {
      next(e);
    }

  }).fail(function(err) {
    next(err);
  });
};
