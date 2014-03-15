var Cores = require('cores');
var Common = require('./lib/common.js');
var createApi = require('./lib/create-api.js');

//
// hapi plugin
//
module.exports.register = function(plugin, options, next) {

  if (!options.dbUrl) {
    return next(new Error('No database url specified'));
  }

  Common.debug = options.debug;

  var cores = Cores(options.dbUrl);

  // make sure db is there
  cores.info().then(function(info) {

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
