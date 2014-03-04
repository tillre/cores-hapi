var Q = require('kew');
var Common = require('./common.js');


function Middleware() {
  this.actionHandlers = {};
  this.anyHandlers = {};
  var self = this;

  // generate setter functions for handlers
  Object.keys(Common.ACTIONS).forEach(function(action) {

    self.actionHandlers[action] = {};
    self.anyHandlers[action] = null;

    self[action] = function(name, handler) {
      if (arguments.length === 1 && typeof name === 'function') {
        handler = name;
        self.anyHandlers[action] = handler;
      }
      else {
        self.actionHandlers[action][name] = handler;
      }
    };
  });
}


//
// call the actions handlers
//
Middleware.prototype.handle = function(action, resource, request, payload) {

  var name = resource.name;
  var promise = null;
  var self = this;

  // call the specialized handler
  if (this.actionHandlers[action][name]) {
    promise = this.handleCall(
      this.actionHandlers[action][name], action, resource, request, payload
    );
  }
  // call the generic handler after the specialized
  if (this.anyHandlers[action]) {
    if (promise) {
      promise = promise.then(function(pl) {
        return self.handleCall(self.anyHandlers[action], action, resource, request, pl);
      });
    }
    else {
      promise = this.handleCall(this.anyHandlers[action], action, resource, request, payload);
    }
  }
  // when no handlers exists, return the payload wrapped in a promise
  if (!promise) {
    promise = Q.resolve(payload);
  }
  return promise;
};


//
// wrap the result of a handler call in a promise, if it is not a promise itself
//
Middleware.prototype.handleCall = function(fn, action, resource, request, payload) {
  var result;
  try {
    result = fn(payload, request, resource, action);
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
