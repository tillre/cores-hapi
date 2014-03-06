var I = require('i')();
var Common = require('./common.js');
var Permissions = require('./permissions');
var createHandlers = require('./create-handlers.js');


module.exports = function createRoutes(selection, cores, pre, post, options, next) {

  var auth = options.auth || false;
  var basePath = options.basePath || '';
  var resources = cores.resources;

  // GETtable index listing all model routes
  var index = {};
  var permissions = new Permissions(options.permissions);

  var routeConfigs = {
    general: {},
    resources: {}
  };

  // create resources route configs
  Object.keys(resources).forEach(function(name) {
    var resource = resources[name];
    var path = basePath + '/' + I.pluralize(name.toLowerCase());
    var handlers = createHandlers(resource, pre, post, permissions);

    // index entry
    var info = index[name] = {
      type: name,
      path: path,
      schemaPath: path + '/_schema',
      viewPaths: {}
    };


    routeConfigs.resources[name] = { actions: {
      // GET schema
      schema: {
        method: 'GET',
        path: info.schemaPath,
        config: {
          auth: auth,
          handler: handlers.getSchema
        }
      },
      // GET all, alias for 'all' view
      all: {
        method: 'GET',
        path: info.path,
        config: {
          auth: auth,
          handler: handlers.getView('all')
        }
      },
      // GET by id
      load: {
        method: 'GET',
        path: info.path + '/{id}',
        config: {
          auth: auth,
          handler: handlers.getById
        }
      },
      // POST
      save: {
        method: 'POST',
        path: info.path,
        config: {
          auth: auth,
          handler: handlers.save
        }
      },
      // PUT id
      saveWithId: {
        method: 'PUT',
        path: info.path + '/{id}',
        config: {
          auth: auth,
          handler: handlers.saveWithId
        }
      },
      // PUT id/rev
      update: {
        method: 'PUT',
        path: info.path + '/{id}/{rev}',
        config: {
          auth: auth,
          handler: handlers.update
        }
      },
      // DELETE
      destroy: {
        method: 'DELETE',
        path: info.path + '/{id}/{rev}',
        config: {
          auth: auth,
          handler: handlers.destroy
        }
      }
    }};

    routeConfigs.resources[name].views = {};

    // GET views
    Object.keys(resource.design.views).forEach(function(viewName) {

      var path = info.viewPaths[viewName] = info.path + '/_views/' + viewName;
      if (!path) {
        return;
      }
      routeConfigs.resources[name].views[viewName] = {
        method: 'GET',
        path: path,
        config: {
          auth: auth,
          handler: handlers.getView(viewName)
        }
      };

    });
  });


  //
  // general routes
  //
  routeConfigs.general = {
    // GET resources index
    index: {
      method: 'GET',
      path: basePath + '/_index',
      config: {
        auth: auth,
        handler: function(request, reply) {
          reply(index);
        }
      }
    },
    // GET uuids
    uuids: {
      method: 'GET',
      path: basePath + '/_uuids',
      config: {
        auth: auth,
        handler: function(request, reply) {
          var count = parseInt(request.query.count, 10) || 1;

          cores.uuids(count).then(function(uuids) {
            reply(uuids);
          }, function(err) {
            reply(Common.createError(err));
          });
        }
      }
    }
  };


  if (options.transformRoutes) {
    options.transformRoutes(routeConfigs);
  }

  function each(obj, iter) {
    Object.keys(obj).forEach(function(key) {
      iter(obj[key], key);
    });
  }

  var routes = [];
  each(routeConfigs.general, function(route) {
    routes.push(route);
  });
  each(routeConfigs.resources, function(res) {
    each(res.actions, function(action) {
      routes.push(action);
    });
    each(res.views, function(view) {
      routes.push(view);
    });
  });

  selection.route(routes);

  next();
};
