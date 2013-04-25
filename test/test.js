/*global before after beforeEach afterEach describe it*/

var fs = require('fs');
var expect = require('chai').expect;
var nano = require('nano')('http://localhost:5984');
var request = require('request');
var mountResources = require('../index.js');


var articleData = require('./article-data.js');
var imageData = require('./image-data.js');


describe('cores-api', function() {

  // create db before tests and destroy afterwards
  var dbName = 'test-cores-api',
      db = nano.use(dbName),
      loadResources = require('cores-load');

  
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

    // load modules and mount routes
    before(function(done) {
      loadResources(db, './test', function(err, res) {
        expect(err).to.not.exist;
        expect(res.Article).to.be.a('object');
        expect(res.Image).to.be.a('object');
        resources = res;
        mountResources(resources, server);
        done();
      });
    });

    it('should GET the index', function(done) {
      server.inject(
        { method: 'GET', url: '/_index' },
        function(res) {
          expect(res.statusCode).to.equal(200);
          expect(res.result.Article).to.be.a('object');
          expect(res.result.Article.type).to.equal('Article');
          expect(res.result.Article.path).to.be.a('string');
          expect(res.result.Article.viewPaths).to.be.a('object');
          expect(res.result.Article.viewPaths.all).to.be.a('string');
          expect(res.result.Article.schemaPath).to.be.a('string');
          expect(res.result.Image).to.be.a('object');
          done();
        }
      );
    });
    
    it('should GET the schema', function(done) {
      server.inject(
        { method: 'GET', url: schemaRoute },
        function(res) {
          expect(res.statusCode).to.equal(200);
          expect(res.result.name).to.equal('Article');
          done();
        }
      );
    });

    
    it('should POST', function(done) {
      server.inject(
        { method: 'POST', url: route, payload: JSON.stringify(articleData) },
        function(res) {
          expect(res.statusCode).to.equal(200);

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
          expect(res.statusCode).to.equal(200);
          done();
        }
      );
    });

    
    it('should return errors when POST not validating', function(done) {
      server.inject(
        { method: 'POST', url: route, payload: JSON.stringify({title:42}) },
        function(res) {
          expect(res.statusCode).to.equal(400);
          expect(res.result.errors).to.be.a('array');
          done();
        }
      );
    });

    
    it('should POST multipart', function(done) {
      var file = fs.createReadStream(__dirname + '/test.jpg');
      
      var r = request.post('http://localhost:3333/images', function(err, res) {
        expect(err).to.not.exist;
        expect(res.statusCode).to.equal(200);

        var d = JSON.parse(res.body);
        expect(d.file).to.equal('test.jpg');
        expect(d._id).to.be.a('string');
        expect(d._rev).to.be.a('string');
        
        done();
      });

      var form = r.form();
      form.append('doc', JSON.stringify(imageData));
      form.append('file', file);
    });

    
    it('should GET', function(done) {
      server.inject(
        { method: 'GET', url: route + '/' + docId },
        function(res) {
          expect(res.statusCode).to.equal(200);
          expect(res.result._id).to.equal(docId);
          expect(res.result._rev).to.equal(docRev);
          done();
        }
      );
    });

    
    it('should not GET nonexistant', function(done) {
      server.inject(
        { method: 'GET', url: route + '/asdasd'},
        function(res) {
          expect(res.statusCode).to.equal(404);
          done();
        }
      );
    });

    
    it('should GET the view', function(done) {
      server.inject(
        { method: 'GET', url: viewRoute },
        function(res) {
          expect(res.statusCode).to.equal(200);
          expect(res.result.total_rows).to.equal(2);
          done();
        }
      );
    });

    
    it('should GET the view with params', function(done) {
      server.inject(
        { method: 'GET', url: viewRoute + '?limit=1' },
        function(res) {
          expect(res.statusCode).to.equal(200);
          expect(res.result.rows.length).to.equal(1);
          done();
        }
      );
    });

    // it('should PUT with id', function(done) {
    //   server.inject(
    //     { method: 'PUT', url: route + '/somearticle', payload: JSON.stringify(articleData) },
    //     function(res) {
    //       expect(res.statusCode).to.equal(200);

    //       var d = res.result;
    //       expect(d._id).to.equal('somearticle');
    //       done();
    //     }
    //   );
    // });
    
    it('should PUT with id and rev', function(done) {
      server.inject(
        { method: 'PUT', url: route + '/' + docId + '/' + docRev, payload: JSON.stringify(articleData) },
        function(res) {
          expect(res.statusCode).to.equal(200);
          
          var d = res.result;
          expect(d._id).to.equal(docId);
          expect(d._rev).to.not.equal(docRev);
          docRev = d._rev;
          done();
        }
      );
    });


    it('should return errors when PUT not validating', function(done) {
      server.inject(
        { method: 'PUT', url: route + '/' + docId + '/' + docRev, payload: JSON.stringify({title:42}) },
        function(res) {
          expect(res.statusCode).to.equal(400);
          expect(res.result.errors).to.be.a('array');
          done();
        }
      );
    });

    
    it('should PUT multipart', function(done) {
      var file = fs.createReadStream(__dirname + '/test.jpg');
      
      var r = request.put('http://localhost:3333/images/' + docId + '/' + docRev, function(err, res) {
        expect(err).to.not.exist;
        expect(res.statusCode).to.equal(200);

        var d = JSON.parse(res.body);
        expect(d.file).to.equal('test.jpg');
        expect(d._id).to.be.a('string');
        expect(d._rev).to.be.a('string');
        
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
          expect(res.statusCode).to.equal(200);

          server.inject(
            { method: 'GET', url: route + '/' + docId },
            function(res) {
              expect(res.statusCode).to.equal(404);
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
          expect(res.statusCode).to.equal(400);
          done();
        }
      );
    });
  });
});
