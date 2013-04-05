
var i = require('i')();


function ok(isOk, payload) {
  var r = { ok: isOk };
  if (payload) {
    if (isOk) r.data = payload;
    if (!isOk) r.error = payload;
  }
  return r;
}


function create(comodl) {
  var routes = [];

  Object.keys(comodl.layouts).forEach(function(name) {
    var layout = comodl.layouts[name];
    var route = i.pluralize(name.toLowerCase());

    // GET
    routes.push({
      path: '/' + route,
      method: 'GET',
      handler: function(req) {
        comodl.view(name, 'all', function(err, docs) {
          if (err) req.reply(ok(false, err));
          else     req.reply(ok(true, docs));
        });
      }
    });

    // GET id
    routes.push({
      path: '/' + route + '/{id}',
      method: 'GET',
      handler: function(req) {
        comodl.model.load(req.params.id, function(err, doc) {
          if (err) req.reply(ok(false, err));
          else     req.reply(ok(true, doc));
        });
      }
    });

    // GET views
    Object.keys(layout.design.views).forEach(function(viewName) {
      routes.push({
        path: '/' + name.toLowerCase() + '-' + viewName.toLowerCase(),
        method: 'GET',
        handler: function(req) {
          comodl.view(name, viewName, function(err, docs) {
            if (err) req.reply(ok(false, err));
            else     req.reply(ok(true, docs));
          });
        }
      });
    });

    // POST
    routes.push({
      path: '/' + route,
      method: 'POST',
      handler: function(req) {
        var doc = req.payload;
        // enforce type
        doc.type = name;
          
        comodl.model.save(req.payload, function(err, doc) {
          if (err) req.reply(ok(false, err));
          else     req.reply(ok(true, doc));
        });
      }
    });

    // PUT id
    routes.push({
      path: '/' + route + '/{id}',
      method: 'PUT',
      config: {
        handler: function(req) {
          var doc = req.payload;
          // enforce type
          doc.type = name;
          
          var m = comodl.model.create(doc);
          m._id = req.params.id;
          m._rev = req.query.rev;
          comodl.model.save(m, function(err, doc) {
            if (err) req.reply(ok(false, err));
            else     req.reply(ok(true, doc));
          });
        }
      }
    });

    // DELETE
    routes.push({
      path: '/' + route + '/{id}',
      method: 'DELETE',
      handler: function(req) {
        var rev = req.query.rev;
        comodl.model.destroy(req.params.id, rev, function(err) {
          if (err) req.reply(ok(false, err));
          else     req.reply(ok(true));
        });
      }
    });
  });

  return routes;
}


function mount(comodl, server) {
  var routes = create(comodl);
  routes.forEach(function(route, i) {
    server.route(route);
  });
}


module.exports = {
  create: create,
  mount: mount
};