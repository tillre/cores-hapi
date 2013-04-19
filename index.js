var _ = require('underscore');
var i = require('i')();


function updateErrorCode(err) {
  // default to 500
  err.code = err.code || err.status_code || err.statusCode || 500;
  return err;
}



module.exports = function mountRoutes(comodl, server) {

  // object listing all model routes
  var index = {};
  
  _.each(comodl.layouts, function(layout, name) {

    var path = '/' + i.pluralize(layout.name.toLowerCase());

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
        req.reply(layout.design.schema);
      }
    });

    
    // GET all
    server.route({
      method: 'GET',
      path: info.path,
      handler: function(req) {
        comodl.view(name, 'all', function(err, docs) {
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
        comodl.model.load(req.params.id, function(err, doc) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply(doc);
        });
      }
    });

    
    // GET views
    _.each(layout.design.views, function(view, viewName) {

      var path = info.viewPaths[viewName] = info.path + '/_views/' + viewName;
      if (!path) {
        return;
      }

      server.route({
        method: 'GET',
        path: path,
        
        handler: function(req) {
          comodl.view(name, viewName, function(err, docs) {
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
        doc.doc.type = name;
      }
      else {
        doc = req.payload;
      }
      // enforce type
      doc.type = name;

      return doc;
    }
    
    
    // POST
    server.route({
      method: 'POST',
      path: info.path,

      handler: function(req) {

        var doc = getDocFromRequest(req);
        
        comodl.model.save(doc, function(err, doc) {
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
        
        comodl.model.create(doc, function(err, doc) {

          if (err) req.reply(updateErrorCode(err));

          doc._id = req.params.id;
          doc._rev = req.query.rev;
          
          comodl.model.save(doc, function(err, doc) {
            if (err) req.reply(updateErrorCode(err));
            else req.reply(doc);
          });
        });
      }
    });

    
    // DELETE
    server.route({
      method: 'DELETE',
      path: info.path + '/{id}',

      handler: function(req) {

        var rev = req.query.rev;

        comodl.model.destroy(req.params.id, rev, function(err) {
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





