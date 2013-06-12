var _ = require('underscore');
var i = require('i')();
var hapi = require('hapi');



function updateErrorCode(err) {
  // default to 500
  err.code = err.code || err.status_code || err.statusCode || 500;
  return err;
}


function checkPermissions(request, resource, action, callback) {

  if (request.auth &&
      request.auth.credentials &&
      request.auth.credentials.permissions) {

    var permissions = request.auth.credentials.permissions[resource.name];

    if (permissions && permissions[action]) {
      // permission granted
      callback();
      return;
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


module.exports.register = function(pack, options, next) {

  if (typeof pack.route !== 'function') {
    return next(new Error('Plugin requires route permission'));
  };

  // these need to be provided
  var cores = pack.app.cores;
  var resources = pack.app.resources;

  // index listing all model routes
  var index = {};
  
  _.each(resources, function(resource, name) {

    var path = '/' + i.pluralize(name.toLowerCase());

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
    
    pack.route({
      method: 'GET',
      path: info.schemaPath,

      handler: function(req) {
        req.reply(resource.schema.toJSON());
      }
    });


    //
    // GET all
    //
    
    pack.route({
      method: 'GET',
      path: info.path,

      handler: function(req) {
        resource.view('all', req.query, function(err, docs) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply(docs);
        });
      }
    });


    //
    // GET by id
    //
    
    pack.route({
      method: 'GET',
      path: info.path + '/{id}',

      handler: function(req) {

        checkPermissions(req, resource, 'load', function(err) {
          if (err) {
            req.reply(updateErrorCode(err));
            return;
          }
          resource.load(req.params.id, function(err, doc) {
            if (err) req.reply(updateErrorCode(err));
            else req.reply(doc);
          });
        });
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

      pack.route({
        method: 'GET',
        path: path,
        
        handler: function(req) {
          checkPermissions(req, resource, 'views', function(err) {
            if (err) {
              req.reply(updateErrorCode(err));
              return;
            }
            resource.view(viewName, req.query, function(err, docs) {
              if (err) req.reply(updateErrorCode(err));
              else req.reply(docs);
            });
          });
        }
      });
    });


    //
    // Get the doc from the payload and set isMultipart when multipart data
    //

    function parseSavePayload(req) {

      var doc = req.payload;
      var contentType = req.raw.req.headers['content-type'];

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
    
    function handleSave(req, doc) {
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
            return req.reply(hapi.error.passThrough(err.code, payload, contentType));
          }

          return req.reply(updateErrorCode(err));
        }
        
        return req.reply(doc);
      });
    }


    //
    // POST
    //
    
    pack.route({
      method: 'POST',
      path: info.path,

      handler: function(req) {

        checkPermissions(req, resource, 'save', function(err) {
          if (err) {
            req.reply(updateErrorCode(err));
            return;
          }
          var doc = parseSavePayload(req);
          handleSave(req, doc);
        });
      }
    });


    //
    // PUT id
    //

    pack.route({
      method: 'PUT',
      path: info.path + '/{id}',

      handler: function(req) {

        checkPermissions(req, resource, 'save', function(err) {
          if (err) {
            req.reply(updateErrorCode(err));
            return;
          }
          var doc = parseSavePayload(req);
          doc._id = req.params.id;
          handleSave(req, doc);
        });
      }
    });
    

    //
    // PUT id/rev
    //
    
    pack.route({
      method: 'PUT',
      path: info.path + '/{id}/{rev}',

      handler: function(req) {

        checkPermissions(req, resource, 'save', function(err) {
          if (err) {
            req.reply(updateErrorCode(err));
            return;
          }
          var doc = parseSavePayload(req);

          doc._id = req.params.id;
          doc._rev = req.params.rev;

          handleSave(req, doc);
        });
      }
    });


    //
    // DELETE
    //
    
    pack.route({
      method: 'DELETE',
      path: info.path + '/{id}/{rev}',

      handler: function(req) {

        checkPermissions(req, resource, 'destroy', function(err) {
          if (err) {
            req.reply(updateErrorCode(err));
            return;
          }
          resource.destroy(
            { type_: name, _id: req.params.id, _rev: req.params.rev },
            function(err) {
              if (err) req.reply(updateErrorCode(err));
              else req.reply();
            });
        });
      }
    });
  });


  //
  // GET models/route index
  //
  
  pack.route({
    method: 'GET',
    path: '/_index',

    handler: function(req) {
      req.reply(index);
    }
  });


  //
  // GET uuids
  //

  pack.route({
    method: 'GET',
    path: '/_uuids',

    handler: function(req) {
      var count = parseInt(req.query.count, 10) || 1;
      cores.uuids(count, function(err, uuids) {
        if (err) req.reply(updateErrorCode(err));
        else req.reply(uuids);
      });
    }
  });

  next();
};

