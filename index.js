var _ = require('underscore');
var i = require('i')();
var hapi = require('hapi');

var createResourceHandlers = require('./lib/resource-handlers.js');


var ACTIONS = {
  load: 'load',
  create: 'create',
  update: 'update',
  destroy: 'destroy',
  views: 'views'
};


module.exports.register = function(plugin, options, next) {

  if (typeof plugin.route !== 'function') {
    return next(new Error('Plugin requires route permission'));
  };

  // these need to be provided
  var cores = options.cores;
  var resources = options.resources;

  // these are optional
  var config = {
    handlers: options.handlers || {},
    auth: options.auth || false,
    basePath: options.basePath || ''
  };

  // index listing all model routes
  var index = {};

  _.each(resources, function(resource, name) {

    var handlers = config.handlers[name] || {};
    var viewHandlers = handlers[ACTIONS.views] || {};
    var path = config.basePath + '/' + i.pluralize(name.toLowerCase());

    var routeHandlers = createResourceHandlers(ACTIONS, resource, name, handlers);
    
    // index entry
    var info = index[name] = {
      type: name,
      path: path,
      schemaPath: path + '/_schema',
      viewPaths: {}
    };

    //
    // GET schema
    //
    
    plugin.route({
      method: 'GET',
      path: info.schemaPath,
      config: {
        auth: config.auth,
        handler: routeHandlers.getSchema
      }
    });

    //
    // GET all, alias for 'all' view
    //
    
    plugin.route({
      method: 'GET',
      path: info.path,
      config: {
        auth: config.auth,
        handler: routeHandlers.getView('all', viewHandlers['all'])
      }
    });

    //
    // GET by id
    //
    
    plugin.route({
      method: 'GET',
      path: info.path + '/{id}',
      config: {
        auth: config.auth,
        handler: routeHandlers.getById
      }
    });

    //
    // GET views
    //
    
    _.each(resource.design.views, function(view, viewName) {

      var path = info.viewPaths[viewName] = info.path + '/_views/' + viewName;
      if (!path) {
        return;
      }

      plugin.route({
        method: 'GET',
        path: path,
        config: {
          auth: config.auth,
          handler: routeHandlers.getView(viewName, viewHandlers[viewName])
        }
      });
    });

    //
    // POST
    //
    
    plugin.route({
      method: 'POST',
      path: info.path,
      config: {
        auth: config.auth,
        handler: routeHandlers.save
      }
    });

    //
    // PUT id
    //

    plugin.route({
      method: 'PUT',
      path: info.path + '/{id}',
      config: {
        auth: config.auth,
        handler: routeHandlers.saveWithId
      }
    });

    //
    // PUT id/rev
    //
    
    plugin.route({
      method: 'PUT',
      path: info.path + '/{id}/{rev}',
      config: {
        auth: config.auth,
        handler: routeHandlers.updateWithId
      }
    });

    //
    // DELETE
    //
    
    plugin.route({
      method: 'DELETE',
      path: info.path + '/{id}/{rev}',
      config: {
        auth: config.auth,
        handler: routeHandlers.destroy
      }
    });
  });

  //
  // GET models/route index
  //
  
  plugin.route({
    method: 'GET',
    path: config.basePath + '/_index',
    config: {
      auth: config.auth,
      handler: function() {
        this.reply(index);
      }
    }
  });

  //
  // GET uuids
  //

  plugin.route({
    method: 'GET',
    path: config.basePath + '/_uuids',
    config: {
      auth: config.auth,
      handler: function() {
        var self = this;
        var count = parseInt(this.query.count, 10) || 1;

        cores.uuids(count, function(err, uuids) {
          if (err) self.reply(updateErrorCode(err));
          else self.reply(uuids);
        });
      }
    }
  });

  next();
};

