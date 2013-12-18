var i = require('i')();
var hapi = require('hapi');

var Permissions = require('./permissions');
var updateErrorCode = require('./update-error-code.js');
var createHandlers = require('./create-handlers.js');


module.exports = function createApi(selection, cores, handlers, options, next) {

  var auth = options.auth || false;
  var basePath = options.basePath || '';

  var resources = cores.resources;
  var permissions = new Permissions(auth);

  // index listing all model routes
  var index = {};

  //
  // resource specific routes
  //
  Object.keys(resources).forEach(function(name) {
    var resource = resources[name];
    var path = basePath + '/' + i.pluralize(name.toLowerCase());
    var routeHandlers = createHandlers(permissions, resource, name, handlers);

    // index entry
    var info = index[name] = {
      type: name,
      path: path,
      schemaPath: path + '/_schema',
      viewPaths: {}
    };

    selection.route([
      // GET schema
      {
        method: 'GET',
        path: info.schemaPath,
        config: {
          auth: auth,
          handler: routeHandlers.getSchema
        }
      },
      // GET all, alias for 'all' view
      {
        method: 'GET',
        path: info.path,
        config: {
          auth: auth,
          handler: routeHandlers.getView('all')
        }
      },
      // GET by id
      {
        method: 'GET',
        path: info.path + '/{id}',
        config: {
          auth: auth,
          handler: routeHandlers.getById
        }
      },
      // POST
      {
        method: 'POST',
        path: info.path,
        config: {
          auth: auth,
          handler: routeHandlers.save
        }
      },
      // PUT id
      {
        method: 'PUT',
        path: info.path + '/{id}',
        config: {
          auth: auth,
          handler: routeHandlers.saveWithId
        }
      },
      // PUT id/rev
      {
        method: 'PUT',
        path: info.path + '/{id}/{rev}',
        config: {
          auth: auth,
          handler: routeHandlers.update
        }
      },
      // DELETE
      {
        method: 'DELETE',
        path: info.path + '/{id}/{rev}',
        config: {
          auth: auth,
          handler: routeHandlers.destroy
        }
      }
    ]);

    // GET views
    Object.keys(resource.design.views).forEach(function(viewName) {

      var path = info.viewPaths[viewName] = info.path + '/_views/' + viewName;
      if (!path) {
        return;
      }
      selection.route({
        method: 'GET',
        path: path,
        config: {
          auth: auth,
          handler: routeHandlers.getView(viewName)
        }
      });
    });
  });

  //
  // general routes
  //
  selection.route([
    // GET resources index
    {
      method: 'GET',
      path: basePath + '/_index',
      config: {
        auth: auth,
        handler: function() {
          this.reply(index);
        }
      }
    },
    // GET uuids
    {
      method: 'GET',
      path: basePath + '/_uuids',
      config: {
        auth: auth,
        handler: function() {
          var self = this;
          var count = parseInt(this.query.count, 10) || 1;

          cores.uuids(count).then(function(uuids) {
            self.reply(uuids);
          }, function(err) {
            self.reply(updateErrorCode(err));
          });
        }
      }
    }
  ]);

  next();
};
