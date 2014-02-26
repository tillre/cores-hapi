var Q = require('kew');


function Middleware() {
  this.handlers = {};
}


Middleware.prototype.when = function(action, name, handler) {

  this.handlers[name] = this.handlers[name] || {};
  this.handlers[name][action] = handler;
};


//
// call the appropriate handler and return the resulting promise
// when no promise is returned from the handler, wrap the result in a promise
//
Middleware.prototype.handle = function(action, resource, request, payload) {

  var name = resource.name;
  if (!this.handlers[name] || !this.handlers[name][action]) {
    return Q.resolve(payload);
  }

  var result;
  try {
    result = this.handlers[name][action](payload, request, resource, action);
  }
  catch(err) {
    return Q.reject(err);
  }
  if (result && typeof result === 'object' && Q.isPromise(result)) {
    return result;
  }
  return Q.resolve(result);
};


module.exports = Middleware;
