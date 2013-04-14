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
      path: path,
      schema: path + '/_schema',
      views: {}
    };
    
    // GET schema
    server.route({
      method: 'GET',
      path: info.schema,
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
      var viewPath = info.views[viewName] = info.path + '/_views/' + viewName;
      if (!viewPath) {
        return;
      }
      server.route({
        method: 'GET',
        path: viewPath,
        handler: function(req) {
          comodl.view(name, viewName, function(err, docs) {
            if (err) req.reply(updateErrorCode(err));
            else req.reply(docs);
          });
        }
      });
    });


    // POST
    server.route({
      method: 'POST',
      path: info.path,
      handler: function(req) {
        var doc = req.payload;
        // enforce type
        doc.type = name;
        
        comodl.model.save(req.payload, function(err, doc) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply(doc);
        });
      }
    });


    // PUT id
    server.route({
      method: 'PUT',
      path: info.path + '/{id}',
      config: {
        handler: function(req) {
          var doc = req.payload;
          // enforce type
          doc.type = name;
          
          var m = comodl.model.create(doc);
          m._id = req.params.id;
          m._rev = req.query.rev;
          comodl.model.save(m, function(err, doc) {
            if (err) req.reply(updateErrorCode(err));
            else req.reply(doc);
          });
        }
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





