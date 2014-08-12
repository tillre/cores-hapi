/*global before after beforeEach afterEach describe it*/

var Fs = require('fs');
var assert = require('assert');
var Util = require('util');

var Hapi = require('hapi');
var Request = require('request');
var Q = require('kew');
var Cores = require('cores');
var Middleware = require('../lib/middleware.js');
var Common = require('../lib/common.js');



var dbUrl = 'http://localhost:5984/test-cores-hapi';

var articleData = require('./article-data.js');
var imageData = require('./image-data.js');

var articlesRoute = '/articles';
var schemaRoute = '/articles/_schema';
var viewRoute = '/articles/_views/titles';



function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}


describe('cores-hapi', function() {

  var cores, server;

  var startServer = function(apiOptions, callback) {
    server = new Hapi.Server('127.0.0.1', 3333);

    if (apiOptions && apiOptions.auth) {
      server.auth.scheme('basic', function(server, options) {
        return {
          authenticate: function(request, reply) {
            reply(Hapi.error.unauthorized('no way'));
          }
        };
      });
      server.auth.strategy('basic', 'basic', true);
    }

    server.pack.register({
      plugin: require('../index.js'),
      options: { cores: Cores(dbUrl) }
    }, function(err) {
      if (err) return callback(err);

      var coresHapi = server.pack.plugins['cores-hapi'];
      cores = coresHapi.cores;
      cores.load(__dirname, null, true).then(function() {
        if (apiOptions) {
          try {
            coresHapi.createApi(apiOptions);
          }
          catch(e) {
            callback(e);
          }
        }

        server.start(function(err) {
          callback(err, server);
        });

      }, callback);
    });
  };


  var stopServer = function(done) {
    server.stop(done);
  };

  var couchdb = Cores(dbUrl).couchdb;

  before(function(done) {
    couchdb.info().then(function() {
      return couchdb.destroyDB().then(function() {
        return couchdb.createDB();
      });
    }, function(err) {
      return couchdb.createDB();
    }).then(function() {
      done();
    }, done);
  });


  after(function(done) {
    couchdb.destroyDB().then(function() { done(); }, done);
  });



  describe('Middleware', function() {

    it('should return payload', function(done) {
      var m = new Middleware();
      m.handle('load', {}, {}, { isPayload: true }).then(function(payload) {
        assert(payload.isPayload);
        done();
      }, done);
    });


    it('should call the specialized handler', function(done) {
      var m = new Middleware();

      m.load('Foo', function(payload, request, resource , action) {
        assert(payload.isPayload);
        assert(request.isRequest);
        assert(resource.name === 'Foo');
        assert(action === 'load');
        payload.wasCalled = true;
        return payload;
      });

      m.handle('load', { name: 'Foo'}, { isRequest: true }, { isPayload: true }).then(function(result) {
        assert(result.wasCalled);
        done();
      }, done);
    });


    it('should call the generic handler', function(done) {
      var m = new Middleware();

      m.load(function(payload, request, resource , action) {
        assert(payload.isPayload);
        assert(request.isRequest);
        assert(resource.name === 'Foo');
        assert(action === 'load');
        payload.wasCalled = true;
        return payload;
      });

      m.handle('load', { name: 'Foo'}, { isRequest: true }, { isPayload: true }).then(function(result) {
        assert(result.wasCalled);
        done();
      }, done);
    });


    it('should call the specialized and generic handler', function(done) {
      var m = new Middleware();
      var sc = false;
      var gc = false;

      m.load('Foo', function(payload, request, resource , action) {
        assert(!payload.gc);
        payload.sc = true;
        return payload;
      });

      m.load(function(payload, request, resource , action) {
        assert(payload.sc);
        payload.gc = true;
        return payload;
      });

      m.handle('load', { name: 'Foo'}, { isRequest: true }, { isPayload: true }).then(function(result) {
        assert(result.sc);
        assert(result.gc);
        done();
      }, done);
    });


    it('should propagate error', function(done) {
      var m = new Middleware();

      m.load('Foo', function() {
        throw new Error('error');
      });

      m.handle('load', { name: 'Foo' }, {}, {}).then(function() {
        done(new Error('Promise should fail'));
      }, function(err) {
        assert(Util.isError(err));
        done();
      });
    });
  });


  describe('api', function() {

    var docId = null;
    var doc2Id = null;
    var docRev = null;
    var uuid = null;

    var imageHandler = function(payload) {
      if (payload.isMultipart) {
        return Q.resolve(payload.doc);
      }
      else {
        return Q.resolve(payload);
      }
    };

    before(function(done) {
      startServer(true, function(err, server) {
        if (err) return done(err);
        server.plugins['cores-hapi'].pre.create('Image', imageHandler);
        server.plugins['cores-hapi'].pre.update('Image', imageHandler);
        done();
      });
    });

    after(stopServer);


    it('should GET the index', function(done) {
      server.inject(
        { method: 'GET', url: '/_index' },
        function(res) {
          assert(res.statusCode === 200);
          assert(typeof res.result.Article === 'object');
          assert(res.result.Article.type === 'Article');
          assert(typeof res.result.Article.path === 'string');
          assert(typeof res.result.Article.viewPaths === 'object');
          assert(typeof res.result.Article.viewPaths.all === 'string');
          assert(typeof res.result.Article.searchPaths === 'object');
          assert(typeof res.result.Article.searchPaths.titles === 'string');
          assert(typeof res.result.Article.schemaPath === 'string');
          assert(typeof res.result.Image === 'object');
          done();
        }
      );
    });

    it('should GET a uuid', function(done) {
      server.inject(
        { method: 'GET', url: '/_uuids' },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.uuids.length === 1);

          uuid = res.result.uuids[0];

          done();
        }
      );
    });

    it('should GET multiple uuids', function(done) {
      server.inject(
        { method: 'GET', url: '/_uuids?count=5' },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.uuids.length === 5);
          done();
        }
      );
    });

    it('should GET the schema', function(done) {
      server.inject(
        { method: 'GET', url: schemaRoute },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.title === 'Article');
          done();
        }
      );
    });


    it('should POST', function(done) {
      server.inject(
        { method: 'POST', url: articlesRoute, payload: JSON.stringify(articleData) },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.type_ === 'Article');

          docId = res.result._id;
          docRev = res.result._rev;
          done();
        }
      );
    });


    it('should POST another doc', function(done) {
      var doc = clone(articleData);
      doc.other = { id_: docId };

      server.inject(
        { method: 'POST', url: articlesRoute, payload: JSON.stringify(doc) },
        function(res) {
          assert(res.statusCode == 200);
          doc2Id = res.result._id;
          done();
        }
      );
    });


    it('should return errors when POST not validating', function(done) {
      server.inject(
        { method: 'POST', url: articlesRoute, payload: JSON.stringify({title:42}) },
        function(res) {
          assert(res.statusCode === 400);
          assert(Util.isArray(res.result.errors));
          done();
        }
      );
    });


    it('should POST multipart', function(done) {
      var file = Fs.createReadStream(__dirname + '/test.jpg');

      var r = Request.post('http://localhost:3333/images', function(err, res) {
        assert(!err);
        assert(res.statusCode === 200);

        var d = JSON.parse(res.body);
        assert(d.file === 'test.jpg');
        assert(typeof d._id === 'string');
        assert(typeof d._rev === 'string');
        assert(d.type_ === 'Image');

        done();
      });

      var form = r.form();
      form.append('doc', JSON.stringify(imageData));
      form.append('file', file);
    });


    it('should GET all', function(done) {
      server.inject(
        { method: 'GET', url: articlesRoute },
        function(res) {
          assert(res.result.total_rows > 1);
          assert(res.result.rows.length > 1);
          done();
        }
      );
    });


    it('should GET all with params', function(done) {
      server.inject(
        { method: 'GET', url: articlesRoute + '?limit=1' },
        function(res) {
          assert(res.result.total_rows > 1);
          assert(res.result.rows.length === 1);
          done();
        }
      );
    });


    it('should GET', function(done) {
      server.inject(
        { method: 'GET', url: articlesRoute + '/' + docId },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result._id === docId);
          assert(res.result._rev === docRev);
          done();
        }
      );
    });


    it('should GET with included refs', function(done) {
      server.inject(
        { method: 'GET', url: articlesRoute + '/' + doc2Id + '?include_refs=true' },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.other.id_ === docId);
          done();
        }
      );
    });


    it('should not GET nonexistant', function(done) {
      server.inject(
        { method: 'GET', url: articlesRoute + '/asdasd'},
        function(res) {
          assert(res.statusCode === 404);
          done();
        }
      );
    });


    it('should GET the view', function(done) {
      server.inject(
        { method: 'GET', url: viewRoute },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.total_rows >= 2);
          done();
        }
      );
    });


    it('should GET the view with params', function(done) {
      server.inject(
        { method: 'GET', url: viewRoute + '?limit=1' },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.rows.length === 1);
          done();
        }
      );
    });


    it('should GET the view with included refs', function(done) {
      var query = '?limit=1&keys=' + encodeURIComponent('["' + doc2Id + '"]') + '&include_docs=true&include_refs=true';
      server.inject(
        { method: 'GET', url: viewRoute + query},
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.rows[0].doc.other._id === docId);
          done();
        }
      );
    });


    it('should PUT with id', function(done) {
      server.inject(
        { method: 'PUT', url: articlesRoute + '/' + uuid, payload: JSON.stringify(articleData) },
        function(res) {
          assert(res.statusCode === 200);

          var d = res.result;
          assert(d.type_ === 'Article');
          assert(d._id === uuid);
          done();
        }
      );
    });


    it('should PUT with id and rev', function(done) {
      server.inject(
        { method: 'PUT', url: articlesRoute + '/' + docId + '/' + docRev, payload: JSON.stringify(articleData) },
        function(res) {
          assert(res.statusCode === 200);

          var d = res.result;
          assert(d.type_ === 'Article');
          assert(d._id === docId);
          assert(d._rev !== docRev);
          docRev = d._rev;
          done();
        }
      );
    });


    it('should return errors when PUT not validating', function(done) {
      server.inject(
        { method: 'PUT', url: articlesRoute + '/' + docId + '/' + docRev, payload: JSON.stringify({title:42}) },
        function(res) {
          assert(res.statusCode === 400);
          assert(Util.isArray(res.result.errors));
          done();
        }
      );
    });


    it('should PUT multipart', function(done) {
      var file = Fs.createReadStream(__dirname + '/test.jpg');

      var r = Request.put('http://localhost:3333/images/' + docId + '/' + docRev, function(err, res) {
        assert(!err);
        assert(res.statusCode === 200);

        var d = JSON.parse(res.body);
        assert(d.file === 'test.jpg');
        assert(typeof d._id === 'string');
        assert(typeof d._rev === 'string');
        assert(d.type_ === 'Image');

        done();
      });

      var form = r.form();
      form.append('doc', JSON.stringify(imageData));
      form.append('file', file);
    });


    it('should DELETE', function(done) {
      server.inject(
        { method: 'DELETE', url: articlesRoute + '/' + docId + '/' + docRev },

        function(res) {
          assert(res.statusCode === 200);

          server.inject(
            { method: 'GET', url: articlesRoute + '/' + docId },
            function(res) {
              assert(res.statusCode === 404);
              done();
            }
          );
        }
      );
    });


    it('should not DELETE nonexistant', function(done) {
      server.inject(
        { method: 'DELETE', url: articlesRoute + '/' + docId + '/' + docRev},
        function(res) {
          assert(res.statusCode === 404);
          done();
        }
      );
    });
  });



  describe('handlers', function() {

    var articleDoc;
    var preHandlerCalls = {};
    var postHandlerCalls = {};
    var preAnyHandlerCalls = {};
    var postAnyHandlerCalls = {};

    before(function(done) {
      startServer(true, function(err, server) {
        var pre = server.plugins['cores-hapi'].pre;
        var post = server.plugins['cores-hapi'].post;

        function createHandler(calls, name) {
          return function(payload) {
            calls[name] = true;
            return payload;
          };
        };

        Object.keys(Common.ACTIONS).forEach(function(action) {
          pre[action]('Article', createHandler(preHandlerCalls, action));
          post[action]('Article', createHandler(postHandlerCalls, action));

          pre[action](function(payload) {
            preAnyHandlerCalls[action] = true;
            return payload;
          });
          post[action](function(payload) {
            postAnyHandlerCalls[action] = true;
            return payload;
          });
        });

        done();
      });
    });

    after(stopServer);

    it('should call the create handler on POST', function(done) {
      var doc = clone(articleData);
      server.inject(
        { method: 'POST', url: '/articles', payload: JSON.stringify(doc) },
        function(res) {
          assert(res.statusCode === 200);
          assert(preHandlerCalls.create);
          assert(postHandlerCalls.create);

          preHandlerCalls.create = false;
          postHandlerCalls.create = false;

          articleDoc = res.result;
          done();
        }
      );
    });


    it('should call the create handler on PUT/id', function(done) {
      var doc = clone(articleData);
      server.inject(
        { method: 'PUT', url: '/articles/handler_test', payload: JSON.stringify(doc) },
        function(res) {
          assert(res.statusCode === 200);
          assert(preHandlerCalls.create);
          assert(postHandlerCalls.create);
          done();
        }
      );
    });


    it('should call the update handler on PUT/id/rev', function(done) {
      server.inject(
        { method: 'PUT', url: '/articles/' + articleDoc._id + '/' + articleDoc._rev, payload: JSON.stringify(articleDoc) },
        function(res) {
          assert(res.statusCode === 200);
          assert(preHandlerCalls.update);
          assert(postHandlerCalls.update);

          articleDoc = res.result;
          done();
        }
      );
    });


    it('should call the load handler on GET/id', function(done) {
      server.inject(
        { method: 'GET', url: '/articles/' + articleDoc._id },
        function(res) {
          assert(res.statusCode === 200);
          assert(preHandlerCalls.load);
          assert(postHandlerCalls.load);
          done();
        }
      );
    });


    it('should call the view handler on GET/view', function(done) {
      server.inject(
        { method: 'GET', url: '/articles/_views/titles' },
        function(res) {
          assert(res.statusCode === 200);
          assert(preHandlerCalls.view);
          assert(postHandlerCalls.view);
          done();
        }
      );
    });


    it('should call the destroy handler on DELETE/id/rev', function(done) {
      server.inject(
        { method: 'DELETE', url: '/articles/' + articleDoc._id + '/' + articleDoc._rev },
        function(res) {
          assert(res.statusCode === 200);
          assert(preHandlerCalls.destroy);
          assert(postHandlerCalls.destroy);
          done();
        }
      );
    });


    it('should have called the all pre/post handler', function() {
      Object.keys(Common.ACTIONS).forEach(function(action) {
        if (action === 'search') return;
        if (action === 'schema') return;
        assert(preAnyHandlerCalls[action]);
        assert(postAnyHandlerCalls[action]);
      });
    });
  });


  describe('api with auth', function() {

    before(function(done) {
      startServer({ auth: 'basic' }, done);
    });

    after(stopServer);

    var routes = [
      { name: 'GET/index', method: 'get', url: 'http://localhost:3333/_index' },

      { name: 'GET', method: 'get', url: 'http://localhost:3333/articles' },
      { name: 'GET/id', method: 'get', url: 'http://localhost:3333/articles/auth_article' },
      { name: 'GET/_schema', method: 'get', url: 'http://localhost:3333/articles/_schema' },
      { name: 'GET/_views/*', method: 'get', url: 'http://localhost:3333/articles/_views/titles' },

      { name: 'POST', method: 'post', url: 'http://localhost:3333/articles' },
      { name: 'PUT/id', method: 'put', url: 'http://localhost:3333/articles/auth_article' },
      { name: 'PUT/id/rev', method: 'put', url: 'http://localhost:3333/articles/auth_article/123' },

      { name: 'DELETE/id/rev', method: 'del', url: 'http://localhost:3333/articles/auth_article/123' },

      { name: 'GET/_index', method: 'get', url: 'http://localhost:3333/_index' },
      { name: 'GET/_uuids', method: 'get', url: 'http://localhost:3333/_uuids' }
    ];

    routes.forEach(function(route) {
      it('should not ' + route.name, function(done) {
        var r = Request[route.method](route.url, function(err, res) {
          assert(!err);
          assert(res.statusCode === 401);
          done();
        });
      });
    });
  });


  describe('api with basePath', function() {

    before(function(done) {
      startServer({ basePath: '/foo' }, done);
    });

    after(stopServer);

    it('should get the index', function(done) {
      var r = Request.get('http://localhost:3333/foo/_index', function(err, res) {
        assert(!err);
        assert(res.statusCode === 200);
        done();
      });
    });
  });


  describe('transform routes', function() {

    before(function(done) {
      startServer({
        auth: 'basic',
        transformRoutes: function(routes) {
          routes.general.index.path = '/_changedindex';
          routes.general.index.config.auth = false;
        }
      }, done);
    });

    after(stopServer);

    it('should get index without auth and under different route', function(done) {
      var r = Request.get('http://localhost:3333/_changedindex', function(err, res) {
        assert(res.statusCode === 200);
        done();
      });
    });
  });


  describe('permissions', function() {

    var funkyCalled = false;
    var funkyPromiseCalled = false;

    var articleId, articleRev;

    var permissions = {
      getRole: function(request) {
        return request.auth.credentials.role;
      },
      roles: {
        admin: true,
        editor: {
          Article: {
            load: true,
            create: true,
            update: true,
            destroy: false,
            view: true,
            schema: true
          }
        },
        funky: {
          Article: {
            load: function() {
              funkyCalled = true;
              return true;
            }
          }
        },
        funkyPromise: {
          Article: {
            load: function(role, action, resource, request) {
              return resource.load(request.params.id).then(function(doc) {
                funkyPromiseCalled = true;
                return true;
              });
            }
          }
        }
      }
    };

    before(function(done) {
      startServer({ permissions: permissions }, done);
    });

    after(stopServer);

    it('should have rights to save', function(done) {
      var payload = clone(articleData);
      payload.role = 'editor';

      server.inject(
        { method: 'POST', url: articlesRoute, payload: articleData, credentials: { role: 'editor' } },
        function(res) {
          assert(res.statusCode === 200);
          articleId = res.result._id;
          articleRev = res.result._rev;
          done();
        }
      );
    });


    it('should not have rights to destroy', function(done) {
      server.inject(
        { method: 'DELETE', url: articlesRoute + '/' + articleId + '/' + articleRev, credentials: { role: 'editor' } },
        function(res) {
          assert(res.statusCode === 401);
          done();
        }
      );
    });


    it('should have rights to update', function(done) {
      server.inject(
        { method: 'PUT', url: articlesRoute + '/' + articleId + '/' + articleRev, payload: JSON.stringify(articleData), credentials: { role: 'editor' }},
        function(res) {
          assert(res.statusCode === 200);
          articleRev = res.result._rev;
          done();
        }
      );
    });


    it('should have rights to load', function(done) {
      server.inject(
        { method: 'GET', url: articlesRoute + '/' + articleId, credentials: { role: 'editor' } },
        function(res) {
          assert(res.statusCode === 200);
          done();
        }
      );
    });


    it('should have rights to view', function(done) {
      server.inject(
        { method: 'GET', url: viewRoute, credentials: { role: 'editor' } },
        function(res) {
          assert(res.statusCode === 200);
          done();
        }
      );
    });


    it('should have rights to get schema', function(done) {
      server.inject(
        { method: 'GET', url: schemaRoute, credentials: { role: 'editor' } },
        function(res) {
          assert(res.statusCode === 200);
          done();
        }
      );
    });


    it('should have rights to load when permission is function', function(done) {
      server.inject(
        { method: 'GET', url: articlesRoute + '/' + articleId, credentials: { role: 'funky' } },
        function(res) {
          assert(res.statusCode === 200);
          assert(funkyCalled);
          done();
        }
      );
    });


    it('should have rights to load when permission is function returning a promise', function(done) {
      server.inject(
        { method: 'GET', url: articlesRoute + '/' + articleId, credentials: { role: 'funkyPromise' } },
        function(res) {
          assert(res.statusCode === 200);
          assert(funkyPromiseCalled);
          done();
        }
      );
    });


    it('should have rights to destroy', function(done) {
      server.inject(
        { method: 'DELETE', url: articlesRoute + '/' + articleId + '/' + articleRev, credentials: { role: 'admin' }},
        function(res) {
          assert(res.statusCode === 200);
          done();
        }
      );
    });
  });

});
