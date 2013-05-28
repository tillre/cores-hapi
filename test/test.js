/*global before after beforeEach afterEach describe it*/

var fs = require('fs');
var assert = require('assert');
var util = require('util');

var nano = require('nano')('http://localhost:5984');
var request = require('request');
var createApi = require('../index.js');


var articleData = require('./article-data.js');
var imageData = require('./image-data.js');


describe('cores-hapi', function() {

  // create db before tests and destroy afterwards
  var dbName = 'test-cores-hapi';
  var db = nano.use(dbName);
  var cores = require('cores')(db);

  
  before(function(done) {
    // setup test db
    nano.db.get(dbName, function(err, body) {
      if (!err) {
        // db exists, recreate
        nano.db.destroy(dbName, function(err) {
          if (err) done(err);
          nano.db.create(dbName, done);
        });
      }
      else if (err.reason === 'no_db_file'){
        // create the db
        nano.db.create(dbName, done);
      }
      else done(err);
    });
  });

  after(function(done) {
    nano.db.destroy(dbName, done);
  });

  
  describe('http', function() {

    var resources = null;

    var route = '/articles';
    var schemaRoute = '/articles/_schema';
    var viewRoute = '/articles/_views/titles';

    var server = new (require('hapi').Server)('0.0.0.0', 3333);
    server.start();

    var docId = null;
    var docRev = null;
    var uuid = null;

    // load modules and mount routes
    before(function(done) {
      cores.load('./test', function(err, res) {
        assert(!err);
        assert(typeof res.Article === 'object');
        assert(typeof res.Image === 'object');
        resources = res;
        createApi(cores, resources, server);
        done();
      });
    });

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
        { method: 'POST', url: route, payload: JSON.stringify(articleData) },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result.type_ === 'Article');
          
          docId = res.result._id;
          docRev = res.result._rev;
          done();
        }
      );
    });

    
    it('should POST another article doc', function(done) {
      server.inject(
        { method: 'POST', url: route, payload: JSON.stringify(articleData) },
        function(res) {
          assert(res.statusCode == 200);
          done();
        }
      );
    });

    
    it('should return errors when POST not validating', function(done) {
      server.inject(
        { method: 'POST', url: route, payload: JSON.stringify({title:42}) },
        function(res) {
          assert(res.statusCode === 400);
          assert(util.isArray(res.result.errors));
          done();
        }
      );
    });

    
    it('should POST multipart', function(done) {
      var file = fs.createReadStream(__dirname + '/test.jpg');
      
      var r = request.post('http://localhost:3333/images', function(err, res) {
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
        { method: 'GET', url: route },
        function(res) {
          assert(res.result.total_rows > 1);
          assert(res.result.rows.length > 1);
          done();
        }
      );
    });


    it('should GET all with params', function(done) {
      server.inject(
        { method: 'GET', url: route + '?limit=1' },
        function(res) {
          assert(res.result.total_rows > 1);
          assert(res.result.rows.length === 1);
          done();
        }
      );
    });
    
    
    it('should GET', function(done) {
      server.inject(
        { method: 'GET', url: route + '/' + docId },
        function(res) {
          assert(res.statusCode === 200);
          assert(res.result._id === docId);
          assert(res.result._rev === docRev);
          done();
        }
      );
    });

    
    it('should not GET nonexistant', function(done) {
      server.inject(
        { method: 'GET', url: route + '/asdasd'},
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
          assert(res.result.total_rows === 2);
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

    it('should PUT with id', function(done) {
      server.inject(
        { method: 'PUT', url: route + '/' + uuid, payload: JSON.stringify(articleData) },
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
        { method: 'PUT', url: route + '/' + docId + '/' + docRev, payload: JSON.stringify(articleData) },
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
        { method: 'PUT', url: route + '/' + docId + '/' + docRev, payload: JSON.stringify({title:42}) },
        function(res) {
          assert(res.statusCode === 400);
          assert(util.isArray(res.result.errors));
          done();
        }
      );
    });

    
    it('should PUT multipart', function(done) {
      var file = fs.createReadStream(__dirname + '/test.jpg');
      
      var r = request.put('http://localhost:3333/images/' + docId + '/' + docRev, function(err, res) {
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
        { method: 'DELETE', url: route + '/' + docId + '/' + docRev },

        function(res) {
          assert(res.statusCode === 200);

          server.inject(
            { method: 'GET', url: route + '/' + docId },
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
        { method: 'DELETE', url: route + '/' + docId + '/' + docRev},
        function(res) {
          assert(res.statusCode === 400);
          done();
        }
      );
    });
  });
});
