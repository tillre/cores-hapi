var Util = require('util');
var Hapi = require('hapi');
var Q = require('kew');
var Common = require('./common.js');


var ACTIONS = Common.ACTIONS;


//
// Get the doc from the payload and set isMultipart when multipart data
//
function parseSavePayload(resource, request) {

  var payload = request.payload;
  var contentType = request.raw.req.headers['content-type'];

  if (contentType && contentType.indexOf('multipart/form-data') !== -1) {
    if (typeof payload.doc === 'string') {
      payload.doc = JSON.parse(payload.doc);
    }
    payload.doc.type_ = resource.name;
    payload.isMultipart = true;
  }
  // enforce type
  payload.type_ = resource.name;

  return payload;
}


//
// create the route handlers
//
module.exports = function createHandlers(resource, pre, post, permissions) {

  return {

    getSchema: function(request, reply) {
      permissions.check(ACTIONS.schema, resource, request).then(function() {
        reply(resource.schema.toJSON());

      }).fail(function(err) {
        reply(Common.createError(err));
      });
    },


    getById: function(request, reply) {
      var query;

      permissions.check(ACTIONS.load, resource, request).then(function() {
        return pre.handle(ACTIONS.load, resource, request);

      }).then(function() {
        query = Common.parseQuery(request.query);
        return resource.load(request.params.id);

      }).then(function(doc) {
        if (!query.include_refs) {
          return doc;
        }
        return resource.cores.fetchRefs(doc);

      }).then(function(doc) {
        return post.handle(ACTIONS.load, resource, request, doc);

      }).then(function(doc) {
        reply(doc);

      }).fail(function(err) {
        reply(Common.createError(err));
      });
    },


    getView: function(viewName) {
      return function(request, reply) {
        var query;

        permissions.check(ACTIONS.view, resource, request).then(function() {
          return pre.handle(ACTIONS.view, resource, request);

        }).then(function() {
          query = Common.parseQuery(request.query);
          return resource.view(viewName, query);

        }).then(function(result) {
          if (!query.include_refs) {
            return result;
          }
          // use included docs or row values
          var docs = query.include_docs
                ? result.rows.map(function(row) { return row.doc; })
                : result.rows.map(function(row) { return row.value; });

          return resource.cores.fetchRefs(docs).then(function(docs) {
            // return view result instead of docs array,
            // docs array contains references to the rows docs in the result
            return result;
          });

        }).then(function(result) {
          return post.handle(ACTIONS.view, resource, request, result);

        }).then(function(result) {
          reply(result);

        }).fail(function(err) {
          reply(Common.createError(err));
        });
      };
    },


    save: function(request, reply) {
      var doc = parseSavePayload(resource, request);

      permissions.check(ACTIONS.create, resource, request).then(function() {
        return pre.handle(ACTIONS.create, resource, request, doc);

      }).then(function(doc) {
        return resource.save(doc);

      }).then(function(doc) {
        return post.handle(ACTIONS.create, resource, request, doc);

      }).then(function(doc) {
        reply(doc);

      }).fail(function(err) {
        return reply(Common.createError(err));
      });
    },


    saveWithId: function(request, reply) {
      var doc = parseSavePayload(resource, request);
      if (doc._rev) {
        // prevent update, updates should put to /{id}/{rev}
        var err = new Error('Doc with _rev not allowed');
        err.code = 400;
        throw err;
      }
      doc._id = request.params.id;

      permissions.check(ACTIONS.create, resource, request).then(function() {
        return pre.handle(ACTIONS.create, resource, request, doc);

      }).then(function(doc) {
        return resource.save(doc);

      }).then(function(doc) {
        return post.handle(ACTIONS.create, resource, request, doc);

      }).then(function(doc) {
        reply(doc);

      }).fail(function(err) {
        reply(Common.createError(err));
      });
    },


    update: function(request, reply) {
      var doc = parseSavePayload(resource, request);
      doc._id = request.params.id;
      doc._rev = request.params.rev;

      permissions.check(ACTIONS.update, resource, request).then(function() {
        return pre.handle(ACTIONS.update, resource, request, doc);

      }).then(function(doc) {
        return resource.save(doc);

      }).then(function(doc) {
        return post.handle(ACTIONS.update, resource, request, doc);

      }).then(function(doc) {
        reply(doc);

      }).fail(function(err) {
        reply(Common.createError(err));
      });
    },


    destroy: function(request, reply) {
      var doc = {
        type_: resource.name,
        _id: request.params.id,
        _rev: request.params.rev
      };

      permissions.check(ACTIONS.destroy, resource, request).then(function() {
        return pre.handle(ACTIONS.destroy, resource, request, doc);

      }).then(function() {
        return resource.destroy(doc);

      }).then(function() {
        return post.handle(ACTIONS.destroy, resource, request, doc);

      }).then(function() {
        reply();

      }).fail(function(err) {
        reply(Common.createError(err));
      });
    }
  };
};
