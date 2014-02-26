var Util = require('util');
var Hapi = require('hapi');
var Q = require('kew');


var ACTIONS = {
  load: 'load',
  create: 'create',
  update: 'update',
  destroy: 'destroy',
  view: 'view'
};


//
// Get the doc from the payload and set isMultipart when multipart data
//
function parseSavePayload(request, name) {

  var payload = request.payload;
  var contentType = request.raw.req.headers['content-type'];

  if (contentType && contentType.indexOf('multipart/form-data') !== -1) {
    if (typeof payload.doc === 'string') {
      payload.doc = JSON.parse(payload.doc);
    }
    payload.doc.type_ = name;
    payload.isMultipart = true;
  }
  // enforce type
  payload.type_ = name;

  return payload;
}


//
// Create a custom error when there are validation errors
//
function createError(err) {

  if (err.isBoom) {
    return err;
  }

  // create custom error
  var e = Hapi.error.badRequest(err.message);
  e.output.statusCode = err.code || err.status_code || err.statusCode || 500;

  if (err.errors && Util.isArray(err.errors)) {
    e.output.payload.errors = err.errors;
  }
  return e;
}

//
// try parsing query parameters as json
//
function parseQuery(query) {
  query = query || {};
  var q = {};
  for (var x in query) {
    try {
      q[x] = JSON.parse(query[x]);
    }
    catch(e) {
      q[x] = query[x];
    }
  }
  return q;
}



//
// create the route handlers
//
module.exports = function createHandlers(resource, name, pre, post) {

  return {

    getSchema: function(request, reply) {
      reply(resource.schema.toJSON());
    },


    getById: function(request, reply) {
      var query;

      pre.handle(ACTIONS.load, resource, request).then(function() {
        query = parseQuery(request.query);
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
        reply(createError(err));
      });
    },


    getView: function(viewName) {
      return function(request, reply) {
        var query;

        pre.handle(ACTIONS.view, resource, request).then(function() {
          query = parseQuery(request.query);
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
          reply(createError(err));
        });
      };
    },


    save: function(request, reply) {
      var doc = parseSavePayload(request, name);

      pre.handle(ACTIONS.create, resource, request, doc).then(function(doc) {
        return resource.save(doc);

      }).then(function(doc) {
        return post.handle(ACTIONS.create, resource, request, doc);

      }).then(function(doc) {
        reply(doc);

      }).fail(function(err) {
        return reply(createError(err));
      });
    },


    saveWithId: function(request, reply) {
      var doc = parseSavePayload(request, name);
      if (doc._rev) {
        // prevent update, updates should put to /{id}/{rev}
        var err = new Error('Doc with _rev not allowed');
        err.code = 400;
        throw err;
      }
      doc._id = request.params.id;

      pre.handle(ACTIONS.create, resource, request, doc).then(function(doc) {
        return resource.save(doc);

      }).then(function(doc) {
        return post.handle(ACTIONS.create, resource, request, doc);

      }).then(function(doc) {
        reply(doc);

      }).fail(function(err) {
        reply(createError(err));
      });
    },


    update: function(request, reply) {
      var doc = parseSavePayload(request, name);
      doc._id = request.params.id;
      doc._rev = request.params.rev;

      pre.handle(ACTIONS.update, resource, request, doc).then(function(doc) {
        return resource.save(doc);

      }).then(function(doc) {
        return post.handle(ACTIONS.update, resource, request, doc);

      }).then(function(doc) {
        reply(doc);

      }).fail(function(err) {
        reply(createError(err));
      });
    },


    destroy: function(request, reply) {
      var doc = {
        type_: name,
        _id: request.params.id,
        _rev: request.params.rev
      };

      pre.handle(ACTIONS.destroy, resource, request, doc).then(function() {
        return resource.destroy(doc);

      }).then(function() {
        return post.handle(ACTIONS.destroy, resource, request, doc);

      }).then(function() {
        reply();

      }).fail(function(err) {
        reply(createError(err));
      });
    }
  };
};
