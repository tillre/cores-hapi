var _ = require('underscore');
var i = require('i')();
var hapi = require('hapi');



function updateErrorCode(err) {
  // default to 500
  err.code = err.code || err.status_code || err.statusCode || 500;
  return err;
}


// names of the actions compared with permission
var ACTION_NAMES = {
  load: 'load',
  create: 'create',
  update: 'update',
  destroy: 'destroy',
  view: 'view'
};


function checkPermissions(resource, action, callback) {
  // gets called with request as this
  
  if (this.auth &&
      this.auth.credentials &&
      this.auth.credentials.permissions) {

    var permissions = this.auth.credentials.permissions[resource.name];

    if (permissions && permissions[action]) {
      // permission granted
      return callback();
    }
    else {
      var err = new Error('Permission denied');
      err.code = 401;
      callback(err);
    }
  }
  else {
    callback();
  }
};


module.exports.register = function(plugin, options, next) {

  if (typeof plugin.route !== 'function') {
    return next(new Error('Plugin requires route permission'));
  };

  // these need to be provided
  var cores = options.cores;
  var resources = options.resources;
  var auth = options.auth || false;
  var basePath = options.basePath || '';

  // index listing all model routes
  var index = {};
  
  _.each(resources, function(resource, name) {

    var path = basePath + '/' + i.pluralize(name.toLowerCase());

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
        auth: auth,
        handler: function() {
          this.reply(resource.schema.toJSON());
        }
      }
    });


    //
    // GET all
    //
    
    plugin.route({
      method: 'GET',
      path: info.path,
      config: {
        auth: auth,
        handler: function() {

          var self = this;

          checkPermissions.call(this, resource, ACTION_NAMES.load, function(err) {
            if (err) {
              return self.reply(updateErrorCode(err));
            }
            resource.all(self.query, function(err, result) {
              if (err) self.reply(updateErrorCode(err));
              else self.reply(result);
            });
          });
        }
      }
    });


    //
    // GET by id
    //
    
    plugin.route({
      method: 'GET',
      path: info.path + '/{id}',
      config: {
        auth: auth,
        handler: function() {
          var self = this;
          
          checkPermissions.call(this, resource, ACTION_NAMES.load, function(err) {
            if (err) {
              return self.reply(updateErrorCode(err));
            }
            resource.load(self.params.id, function(err, doc) {
              if (err) self.reply(updateErrorCode(err));
              else self.reply(doc);
            });
          });
        }
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
          auth: auth,
          handler: function() {
            var self = this;

            checkPermissions.call(this, resource, ACTION_NAMES.view, function(err) {
              if (err) {
                return self.reply(updateErrorCode(err));
              }
              resource.view(viewName, self.query, function(err, docs) {
                if (err) self.reply(updateErrorCode(err));
                else self.reply(docs);
              });
            });
          }
        }
      });
    });


    //
    // Get the doc from the payload and set isMultipart when multipart data
    //

    function parseSavePayload() {
      // gets called with request as this
      
      var doc = this.payload;
      var contentType = this.raw.req.headers['content-type'];

      if (contentType && contentType.indexOf('multipart/form-data') !== -1) {

        if (typeof doc.doc === 'string') {
          doc.doc = JSON.parse(doc.doc);
        }
        doc.doc.type_ = name;
        doc.isMultipart = true;
      }
      // enforce type
      doc.type_ = name;

      return doc;
    }

    //
    // Handle the saving and reply
    //
    
    function handleSave(doc) {
      // gets called with request as this
      var self = this;
      
      resource.save(doc, function(err, doc) {

        if (err) {
          if (err.message === 'Validation failed') {

            // create a pass through error, to keep validation errors in the payload
            // Hapi.error.reformat will otherwise not include them
            
            var payload = {
              code: err.code,
              message: err.message,
              error: 'Bad Request',
              errors: err.errors
            };
            var contentType = 'application/json';
            return self.reply(hapi.error.passThrough(err.code, payload, contentType));
          }

          return self.reply(updateErrorCode(err));
        }
        
        return self.reply(doc);
      });
    }


    //
    // POST
    //
    
    plugin.route({
      method: 'POST',
      path: info.path,
      config: {
        auth: auth,
        handler: function() {
          var self = this;
          
          checkPermissions.call(this, resource, ACTION_NAMES.create, function(err) {
            if (err) {
              return self.reply(updateErrorCode(err));
            }
            var doc = parseSavePayload.call(self);
            handleSave.call(self, doc);
          });
        }
      }
    });


    //
    // PUT id
    //

    plugin.route({
      method: 'PUT',
      path: info.path + '/{id}',
      config: {
        auth: auth,
        handler: function() {
          var self = this;

          checkPermissions.call(this, resource, ACTION_NAMES.create, function(err) {
            if (err) {
              return self.reply(updateErrorCode(err));
            }
            var doc = parseSavePayload.call(self);

            if (doc._rev) {
              // prevent update, updates should put to /{id}/{rev}
              var err = new Error('Doc with _rev not allowed');
              err.code = 400;
              return self.reply(err);
            }
            
            doc._id = self.params.id;
            handleSave.call(self, doc);
          });
        }
      }
    });
    

    //
    // PUT id/rev
    //
    
    plugin.route({
      method: 'PUT',
      path: info.path + '/{id}/{rev}',
      config: {
        auth: auth,
        handler: function() {
          var self = this;

          checkPermissions.call(this, resource, ACTION_NAMES.update, function(err) {
            if (err) {
              return self.reply(updateErrorCode(err));
            }
            var doc = parseSavePayload.call(self);

            doc._id = self.params.id;
            doc._rev = self.params.rev;

            handleSave.call(self, doc);
          });
        }
      }
    });


    //
    // DELETE
    //
    
    plugin.route({
      method: 'DELETE',
      path: info.path + '/{id}/{rev}',
      config: {
        auth: auth,
        handler: function() {
          var self = this;
          
          checkPermissions.call(this, resource, ACTION_NAMES.destroy, function(err) {
            if (err) {
              return self.reply(updateErrorCode(err));
            }
            resource.destroy(
              { type_: name, _id: self.params.id, _rev: self.params.rev },
              function(err) {
                if (err) self.reply(updateErrorCode(err));
                else self.reply();
              });
          });
        }
      }
    });
  });


  //
  // GET models/route index
  //
  
  plugin.route({
    method: 'GET',
    path: basePath + '/_index',
    config: {
      auth: auth,
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
    path: basePath + '/_uuids',
    config: {
      auth: auth,
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

