var _ = require('underscore');
var i = require('i')();


function updateErrorCode(err) {
  // default to 500
  err.code = err.code || err.status_code || err.statusCode || 500;
  return err;
}



module.exports = function mountRoutes(resources, server) {

  // object listing all model routes
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

    
    // GET schema
    server.route({
      method: 'GET',
      path: info.schemaPath,

      handler: function(req) {
        req.reply(resource.schema);
      }
    });

    
    // GET all
    server.route({
      method: 'GET',
      path: info.path,
      handler: function(req) {
        resource.view('all', req.params, function(err, docs) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply(docs);
        });
      }
    });

    
    // GET by id
    server.route({
      method: 'GET',
      path: info.path + '/{id}',

      handler: function(req) {
        resource.load(req.params.id, function(err, doc) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply(doc);
        });
      }
    });

    
    // GET views
    _.each(resource.design.views, function(view, viewName) {

      var path = info.viewPaths[viewName] = info.path + '/_views/' + viewName;
      if (!path) {
        return;
      }

      server.route({
        method: 'GET',
        path: path,
        
        handler: function(req) {
          resource.view(viewName, req.query, function(err, docs) {
            if (err) req.reply(updateErrorCode(err));
            else req.reply(docs);
          });
        }
      });
    });


    function getDocFromRequest(req) {

      var doc;
      var contentType = req.raw.req.headers['content-type'];

      if (contentType && contentType.indexOf('multipart/form-data') !== -1) {
        // expect payload be of structure { doc: {}, file: {} }
        doc = {
          doc: req.payload.doc,
          file: req.payload.file,
          multipart: true
        };
        if (typeof doc.doc === 'string') {
          doc.doc = JSON.parse(doc.doc);
        }
        // enforce type on inner doc
        doc.doc.type_ = name;
      }
      else {
        doc = req.payload;
      }
      // enforce type
      doc.type_ = name;

      return doc;
    }
    
    
    // POST
    server.route({
      method: 'POST',
      path: info.path,

      handler: function(req) {

        var doc = getDocFromRequest(req);

        resource.save(doc, function(err, doc) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply(doc);
        });
      }
    });


    // PUT id
    server.route({
      method: 'PUT',
      path: info.path + '/{id}',

      handler: function(req) {

        var doc = getDocFromRequest(req);

        doc._id = req.params.id || doc._id;
        doc._rev = req.query.rev || doc._rev;

        resource.save(doc, function(err, doc) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply(doc);
        });
      }
    });

    
    // DELETE
    server.route({
      method: 'DELETE',
      path: info.path + '/{id}/{rev}',

      handler: function(req) {

        resource.destroy({ type_: name, _id: req.params.id, _rev: req.params.rev }, function(err) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply();
        });
      }
    });
  });

  
  // GET models/route index
  server.route({
    method: 'GET',
    path: '/_index',

    handler: function(req) {
      req.reply(index);
    }
  });
};





