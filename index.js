
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
  var routes = {};

  Object.keys(comodl.layouts).forEach(function(name) {
    var layout = comodl.layouts[name];

    var methods = {

      get: function(req, res) {
        var id = req.params.id;
        if (!id) {
          res.send('TODO: provide all models');
        }
        else {
          comodl.model.load(id, function(err, model) {
            if (err) res.send(ok(false, err));
            else res.send(ok(true, model));
          });
        }
      },
      
      post: function(req, res) {
        var model = req.body;
        comodl.model.save(model, function(err, model) {
            if (err) res.send(ok(false, err));
            else res.send(ok(true, model));
        });
      },

      put: function(req, res) {
        var model = req.body;
        comodl.model.save(model, function(err, model) {
          if (err) res.send(ok(false, err));
          else res.send(ok(true, model));
        });
      },

      delete: function(req, res) {
        var id = req.params.id;
        var rev = req.params.rev;
        comodl.model.destroy(id, rev, function(err) {
          if (err) res.send(ok(false, err));
          else res.send(ok(true));
        });
      }
    };
    
    routes[i.pluralize(name.toLowerCase())] = methods;
  });
  return routes;
}


function mount(comodl, app) {
  var routes = create(comodl);
  Object.keys(routes).forEach(function(route) {
    Object.keys(routes[name]).forEach(function(method) {
      app[method]('/' + route, routes[name][method]);
    });
  });
}


module.exports = {
  create: create,
  mount: mount
};