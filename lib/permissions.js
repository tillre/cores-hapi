var Hapi = require('hapi');
var Q = require('kew');


var Permissions = function(config) {

  this.active = !!config;
  if (this.active) {
    this.getRole = config.getRole;
    this.roles = config.roles || {};
  }
};


Permissions.prototype.createError = function(action, resource) {
  return Hapi.error.unauthorized('Permisson denied to ' + action  + ' ' + resource.name);
};


Permissions.prototype.check = function(action, resource, request) {

  var self = this;
  if (!this.active) {
    return Q.resolve();
  }

  // get role fro request
  var role = this.getRole(request);

  // get permisson, anything set to boolean true in permisson path will grant permissons
  // e.g. { admin: true },
  // or   { admin: { 'Article': true }},
  // or   { admin: { 'Article': { create: true }}}
  var pm = this.roles[role];
  if (pm && typeof pm !== 'boolean') {
    pm = pm[resource.name];
    if (pm && typeof pm !== 'boolean') {
      pm = pm[action];
    }
  }

  if (!pm) {
    return Q.reject(this.createError(action, resource));
  }

  // permisson might be a function
  if (typeof pm === 'function') {

    var isAllowed = pm(role, action, resource, request);
    if (!isAllowed) {
      return Q.reject(this.createError(action, resource));
    }

    // function return value might be a promise
    if (typeof isAllowed === 'object' && Q.isPromise(isAllowed)) {
      return isAllowed.then(function(granted) {
        if (!granted) {
          return Q.reject(self.createError(action, resource));
        }
        return granted;
      });
    }
  }
  // grant permission
  return Q.resolve();
};



module.exports = Permissions;
