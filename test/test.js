/*global before after beforeEach afterEach describe it*/

var expect = require('chai').expect;
var nano = require('nano')('http://localhost:5984');
var request = require('request');
var comodlRoutes = require('../index.js');

var articleData = require('./article-data.js');


describe('comodl-routes', function() {

  // create db before tests and destroy afterwards
  var dbName = 'comodl-routes-test',
      db = nano.use(dbName),
      comodlLoad = require('comodl-load')(db);

  
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


  describe('routes', function() {
    var comodl = null;

    // load modules
    before(function(done) {
      comodlLoad('./test', function(err, cm) {
        expect(cm).to.be.a('object');
        comodl = cm;
        done();
      });
    });

    var routes = null,
        modelId = null,
        modelRev = null;

    it('should create the routes', function() {
      routes = comodlRoutes.create(comodl);
      expect(routes).to.exist;
    });

    it('should have the REST routes', function() {
      expect(routes.articles.get).to.be.a('function');
      expect(routes.articles.post).to.be.a('function');
      expect(routes.articles.put).to.be.a('function');
      expect(routes.articles.delete).to.be.a('function');
    });

    it('should have the view routes', function() {
    });

    it('should provide POST', function(done) {
      comodl.model.create('Article', articleData, function(err, m) {
        var req = { body: m };
        var res = { send: function(result) {
          expect(result).to.be.a('object');
          expect(result.ok).to.be.true;
          expect(result.data.id).to.exist;

          modelId = result.data.id;
          modelRev = result.data.rev;
          done();
        }};
        routes.articles.post(req, res);
      });
    });

    it('should provide GET', function(done) {
      var req = { params: { id: modelId } };
      var res = { send: function(result) {
        expect(result).to.be.a('object');
        expect(result.ok).to.be.true;
        expect(result.data.id).to.exist;
        expect(result.data.id).to.equal(modelId);
        expect(result.data.rev).to.equal(modelRev);
        done();
      }};
      routes.articles.get(req, res);
    });

    it('should provide PUT', function(done) {
      comodl.model.load(modelId, function(err, m) {
        expect(err).to.not.exist;
        expect(m.id).to.equal(modelId);
        
        m.title = 'Just Another Title';
        var req = { body: m };
        var res = { send: function(result) {
          expect(result).to.exist;
          expect(result.ok).to.be.true;
          expect(result.data.id).to.equal(modelId);
          expect(result.data.rev).to.not.equal(modelRev);

          modelRev = result.data.rev;
          done();
        }};
        routes.articles.put(req, res);
      });
    });

    it('should provide DELETE', function(done) {
      var req = { params: { id: modelId, rev: modelRev } };
      var res = { send: function(result) {
        expect(result).to.exist;
        expect(result.ok).to.be.true;
        done();
      }};
      routes.articles.delete(req, res);
    });
  });


  // describe('mount', function() {

  //   var comodl = null;
  //   var app = require('express')();
  //   var server = null;
  //   var port = 3333, origin = 'http://localhost:' + port;
    
  //   // load modules and start server
  //   before(function(done) {
  //     comodlLoad('./test', function(err, cm) {
  //       expect(err).to.not.exist;
  //       expect(cm).to.be.a('object');
  //       comodl = cm;
  //       comodlRoutes.mount(comodl, app);
  //       server = app.listen(port);
  //       done();
  //     });
  //   });

  //   after(function() {
  //     server.close();
  //   });
    
  //   it('should accept GET', function(done) {
  //     request(origin + '/articles', function(err, res, body) {
  //       expect(err).to.not.exist;
  //       var data = JSON.parse(body);
  //       expect(data).to.be.a('object');
  //       done();
  //     });
  //   });

  //   it('should accept POST', function(done) {
  //     done();
  //   });

  //   it('should accept PUT', function(done) {
  //     done();
  //   });

  //   it('should accept DELETE', function(done) {
  //     done();
  //   });
  // });
});
