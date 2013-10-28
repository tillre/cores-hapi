var Q = require('kew');


function ApiMiddleware() {

  // action specific handlers, called on all resources
  this.preHandlers = {};
  this.postHandlers= {};
  // resource specific handlers
  this.handlers = {};
  // handlers called by cores-hapi
  this.baseHandlers = {
    load: this.handleAction.bind(this, 'load'),
    create: this.handleAction.bind(this, 'create'),
    update: this.handleAction.bind(this, 'update'),
    destroy: this.handleAction.bind(this, 'destroy'),
    views: this.handleAction.bind(this, 'views')
  };
}


ApiMiddleware.prototype.setPreHandler = function(action, handler) {

  this.preHandlers[action] = handler;
};


ApiMiddleware.prototype.setPostHandler = function(action, handler) {

  this.postHandlers[action] = handler;
};


ApiMiddleware.prototype.setHandler = function(action, resourceName, handler) {

  this.handlers[resourceName] = this.handlers[resourceName] || {};
  this.handlers[resourceName][action] = handler;
};


ApiMiddleware.prototype.handleAction = function(action, request, resource, payload) {

  var promise = Q.resolve(payload);
  promise.setContext({
    action: action,
    resource: resource,
    request: request
  });

  if (this.preHandlers[action]) {
    promise = promise.then(this.preHandlers[action]);
  }
  if (this.handlers[resource.name] && this.handlers[resource.name][action]) {
    promise = promise.then(this.handlers[resource.name][action]);
  }
  if (this.postHandlers[action]) {
    promise = promise.then(this.postHandlers[action]);
  }
  return promise;
};


module.exports = ApiMiddleware;
