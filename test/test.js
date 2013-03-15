/*global before after beforeEach afterEach describe it*/

var expect = require('chai').expect;
var nano = require('nano')('http://localhost:5984');
var request = require('request');
var comodlRoutes = require('../index.js');

var articleData = require('./article-data.js');


describe('comodl-apis', function() {

  // create db before tests and destroy afterwards
  var dbName = 'comodl-api-test',
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
      expect(routes.get['articles']).to.be.a('function');
      expect(routes.get['articles/:id']).to.be.a('function');
      expect(routes.post['articles']).to.be.a('function');
      expect(routes.put['articles']).to.be.a('function');
      expect(routes.put['articles/:id']).to.be.a('function');
      expect(routes.delete['articles/:id/:rev']).to.be.a('function');
    });

    it('should have the view routes', function() {
    });

    it('should provide POST', function(done) {
      var m = comodl.model.create('Article', articleData);
      var req = { body: m };
      var res = { send: function(result) {
        expect(result).to.be.a('object');
        expect(result.ok).to.be.true;
        expect(result.data.id).to.exist;

        modelId = result.data.id;
        modelRev = result.data.rev;
        done();
      }};
      routes.post['articles'](req, res);
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
      routes.get['articles/:id'](req, res);
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
        routes.put['articles'](req, res);
      });
    });

    it('should provide DELETE', function(done) {
      var req = { params: { id: modelId, rev: modelRev } };
      var res = { send: function(result) {
        expect(result).to.exist;
        expect(result.ok).to.be.true;
        done();
      }};
      routes.delete['articles/:id/:rev'](req, res);
    });
  });


  describe('mount', function() {

    var comodl = null;
    var express = require('express');
    var port = 3333;
    var url = 'http://localhost:' + port + '/articles';
    var app = express();
    var server = null;

    var modelId = null;
    var modelRev = null;

    app.use(express.bodyParser());
    
    // load modules and start server
    before(function(done) {
      comodlLoad('./test', function(err, cm) {
        expect(err).to.not.exist;
        expect(cm).to.be.a('object');
        comodl = cm;
        comodlRoutes.mount(comodl, app);
        server = app.listen(port);
        done();
      });
    });

    after(function() {
      server.close();
    });
    
    it('should accept POST', function(done) {
      request.post(
        { url: url, json: { type: 'Article', data: articleData } },
        function(err, res, body) {
          expect(err).to.not.exist;
          expect(body).to.be.a('object');
          expect(body.ok).to.be.true;
          expect(body.data).to.be.a('object');

          modelId = body.data.id;
          modelRev = body.data.rev;
          done();
        }
      );
    });

    it('should accept GET', function(done) {
      request.get(
        { url: url, json: true },
        function(err, res, body) {
          expect(err).to.not.exist;
          expect(body.ok).to.be.true;

          var model = body.data[0];
          expect(model).to.be.a('object');
          expect(model.id).to.exist;
          expect(model.rev).to.exist;
          expect(model.type).to.equal('Article');
          done();
        }
      );
    });

    it('should accept PUT', function(done) {
      request.put(
        { url: url, json: { type: 'Article', data: articleData } },
        function(err, res, body) {
          expect(err).to.not.exist;
          expect(body.ok).to.be.true;

          var model = body.data;
          expect(model.id).to.be.a('string');
          expect(model.rev).to.be.a('string');
          expect(model.type).to.equal('Article');

          modelRev = model.rev;
          done();
        }
      );
    });

    it('should accept DELETE', function(done) {
      var u = url + '/' + modelId + '/' + modelRev;
      request.del(
        { url: u, json: true },
        function(err, res, body) {
          expect(err).to.not.exist;
          expect(body.ok).to.be.true;
          done();
        }
      );
    });
  });
});
