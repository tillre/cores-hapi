var i = require('i')();
var hapi = require('hapi');
var walk = require('walk-fs');

var createResourceHandlers = require('./lib/resource-handlers.js');


var ACTIONS = {
  load: 'load',
  create: 'create',
  update: 'update',
  destroy: 'destroy',
  views: 'views'
};


function loadHandlers(dir, callback) {

  var handlers = {};
  var re = /([\w\-]+)-(handlers)\.js$/i;

  walk(dir, function(path, stats) {

    if (stats.isFile()) {
      var m = path.match(re);
      if (m) {
        var name = m[1].toLowerCase();
        var type = m[2].toLowerCase();
        var cname = i.camelize(name);
        handlers[cname] = require(path);
      }
    }
  }, function(err) {

    if (err) callback(err);
    else callback(null, handlers);
  });
}


function createApi(plugin, options, next) {
  
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

  // _.each(resources, function(resource, name) {
  Object.keys(resources).forEach(function(name) {

    var resource = resources[name];
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
    
    Object.keys(resource.design.views).forEach(function(viewName) {

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
}

//
// exports
//

module.exports.register = function(plugin, options, next) {

  if (typeof plugin.route !== 'function') {
    return next(new Error('Plugin requires route permission'));
  };

  if (typeof options.handlers === 'string') {
    // load handlers
    loadHandlers(options.handlers, function(err, handlers) {
      if (err) return next(err);

      options.handlers = handlers;
      createApi(plugin, options, next);
    });
  }
  else {
    createApi(plugin, options, next);
  }
};


