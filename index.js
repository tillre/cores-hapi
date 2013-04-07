var _ = require('underscore');



function updateErrorCode(err) {
  // default to 500
  err.code = err.code || err.status_code || err.statusCode || 500;
  return err;
}



module.exports = function mountRoutes(comodl, server) {

  _.each(comodl.layouts, function(layout, name) {

    // GET all
    server.route({
      method: 'GET',
      path: layout.path,
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
      path: layout.path + '/{id}',
      handler: function(req) {
        comodl.model.load(req.params.id, function(err, doc) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply(doc);
        });
      }
    });

    // GET views
    _.each(layout.design.views, function(view, viewName) {
      var viewPath = layout.viewPaths[viewName];
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
      path: layout.path,
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
      path: layout.path + '/{id}',
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
      path: layout.path + '/{id}',
      handler: function(req) {
        var rev = req.query.rev;
        comodl.model.destroy(req.params.id, rev, function(err) {
          if (err) req.reply(updateErrorCode(err));
          else req.reply();
        });
      }
    });
  });

};





