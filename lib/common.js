var Util = require('util');
var Hapi = require('hapi');


module.exports.ACTIONS = {
  load: 'load',
  create: 'create',
  update: 'update',
  destroy: 'destroy',
  view: 'view',
  schema: 'schema'
};


//
// Create a custom error when there are validation errors
//
module.exports.createError = function(err) {

  if (err.isBoom) {
    return err;
  }

  // create custom error
  var e = Hapi.error.badRequest(err.message);
  e.output.statusCode = err.code || err.status_code || err.statusCode || 500;

  if (err.errors && Util.isArray(err.errors)) {
    e.output.payload.errors = err.errors;
  }
  return e;
};


//
// try parsing query parameters as json
//
module.exports.parseQuery = function(query) {
  query = query || {};
  var q = {};
  for (var x in query) {
    try {
      q[x] = JSON.parse(query[x]);
    }
    catch(e) {
      q[x] = query[x];
    }
  }
  return q;
};
