
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
  var routes = {
    get: {},
    post: {},
    put: {},
    delete: {}
  };

  Object.keys(comodl.layouts).forEach(function(name) {
    var layout = comodl.layouts[name];
    var route = i.pluralize(name.toLowerCase());
    
    // GET
    routes.get[route] = function(req, res) {
      comodl.view(name, 'all', function(err, docs) {
        if (err) res.send(ok(false, err));
        else     res.send(ok(true, docs));
      });
    };
    routes.get[route + '/:id'] = function(req, res) {
      comodl.model.load(req.params.id, function(err, doc) {
        if (err) res.send(ok(false, err));
        else     res.send(ok(true, doc));
      });
    };

    // POST
    routes.post[route] = function(req, res) {
      comodl.model.save(req.body, function(err, doc) {
        if (err) res.send(ok(false, err));
        else     res.send(ok(true, doc));
      });
    };

    // PUT
    routes.put[route] = function(req, res) {
      comodl.model.save(req.body, function(err, doc) {
        if (err) res.send(ok(false, err));
        else     res.send(ok(true, doc));
      });
    };
    routes.put[route + '/:id'] = function(req, res) {
      var m = comodl.modelcreate(req.params.body);
      m.id = req.params.id;
      comodl.model.save(req.body, function(err, doc) {
        if (err) res.send(ok(false, err));
        else     res.send(ok(true, doc));
      });
    };
      
    // DELETE
    routes.delete[route + '/:id/:rev'] = function(req, res) {
      comodl.model.destroy(req.params.id, req.params.rev, function(err) {
        if (err) res.send(ok(false, err));
        else     res.send(ok(true));
      });
    };
  });

  return routes;
}


function mount(comodl, app) {
  var routes = create(comodl);
  Object.keys(routes).forEach(function(method) {
    Object.keys(routes[method]).forEach(function(route) {
      app[method]('/' + route, routes[method][route]);
    });
  });
}


module.exports = {
  create: create,
  mount: mount
};