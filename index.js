var createApi = require('./lib/create-api.js');

//
// exports
//

module.exports.register = function(plugin, options, next) {

  if (typeof plugin.route !== 'function') {
    return next(new Error('Plugin requires route permission'));
  };
  createApi(plugin, options, next);
};
