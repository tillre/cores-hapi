var Q = require('kew');


var Permissions = function(auth) {
  this.auth = auth;
};


Permissions.prototype.check = function(request, resource, action) {

  if (!this.auth) {
    return Q.resolve();
  }
  else {
    if (request.auth.isAuthenticated &&
        request.auth.credentials.permissions) {

      var permissions = request.auth.credentials.permissions[resource.name];

      if (permissions && permissions[action]) {
        // permission granted
        return Q.resolve();
      }
    }
    var err = new Error('Permission denied');
    err.code = 401;
    return Q.reject(err);
  }
};


module.exports = Permissions;
