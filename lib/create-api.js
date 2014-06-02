var I = require('i')();
var Common = require('./common.js');
var Middleware = require('./middleware');
var Permissions = require('./permissions');
var CreateHandlers = require('./create-handlers.js');



module.exports = function createRoutes(plugin, cores, options) {

  options = options || {};
  var selection = options.selection || plugin;
  var auth = options.auth || false;
  var basePath = options.basePath || '';
  var resources = cores.resources;

  // resource actions middleware
  var pre = new Middleware();
  var post = new Middleware();
  plugin.expose('pre', pre);
  plugin.expose('post', post);


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
    var handlers = CreateHandlers(resource, pre, post, permissions);

    // index entry
    var info = index[name] = {
      type: name,
      path: path,
      schemaPath: path + '/_schema',
      viewPaths: {},
      searchPaths: {}
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

    routeConfigs.resources[name].search = {};

    // GET search
    Object.keys(resource.design.indexes).forEach(function(indexName) {
      var path = info.searchPaths[indexName] = info.path + '/_search/' + indexName;
      if (!path) {
        return;
      }
      routeConfigs.resources[name].search[indexName] = {
        method: 'GET',
        path: path,
        config: {
          auth: auth,
          handler: handlers.getSearch(indexName)
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

  // user hook to transform generated routes
  if (options.transformRoutes) {
    options.transformRoutes(routeConfigs);
  }

  // flatten routes structure into array
  var routes = [];
  // general routes
  Object.keys(routeConfigs.general).forEach(function(key) {
    routes.push(routeConfigs.general[key]);
  });
  // resources routes, each has form { actions: {}, views: {}, search: {}, ... }
  Object.keys(routeConfigs.resources).forEach(function(resKey) {
    var res = routeConfigs.resources[resKey];

    Object.keys(res).forEach(function(collectionKey) {
      Object.keys(res[collectionKey]).forEach(function(routeKey) {

        routes.push(res[collectionKey][routeKey]);
      });
    });
  });

  selection.route(routes);
};
