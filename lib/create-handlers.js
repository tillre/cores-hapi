var hapi = require('hapi');
var Q = require('kew');
var updateErrorCode = require('./update-error-code.js');

//
// run a handler for a resource action
// request, handler and response call order is:
//
// GET -> load doc -> call handler -> response
// POST/PUT -> call handler -> create/save doc -> response
// DELETE -> call handler -> destroy doc -> response
//
function runHandler(request, resource, handler, payload) {
  if (handler) {
    return handler(request, resource, payload);
  }
  return Q.resolve(payload);
}

//
// check permissions for resource action
//
function checkPermissions(request, resource, action) {

  if (request.auth &&
      request.auth.credentials &&
      request.auth.credentials.permissions) {

    var permissions = request.auth.credentials.permissions[resource.name];

    if (permissions && permissions[action]) {
      // permission granted
      return Q.resolve();
    }
    else {
      var err = new Error('Permission denied');
      err.code = 401;
      return Q.reject(err);
    }
  }
  else {
    return Q.resolve();
  }
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
// Handle the saving and reply
//
function handleSave(request, resource, doc) {

  return resource.save(doc).then(function(doc) {
    request.reply(doc);
  });
}

function handleError(request, err) {
  if (err.message === 'Validation failed') {
    // create a pass through error, to keep validation errors in the payload
    // Hapi.error.reformat will otherwise not include them
    var payload = {
      code: err.code,
      message: err.message,
      error: 'Bad Request',
      errors: err.errors
    };
    var contentType = 'application/json';
    return request.reply(hapi.error.passThrough(err.code, payload, contentType));
  }
  request.reply(updateErrorCode(err));
}

//
// create the route handlers
//
module.exports = function createHandlers(ACTIONS, resource, name, handlers) {

  return {

    getSchema: function() {
      this.reply(resource.schema.toJSON());
    },


    getById: function() {

      var self = this;
      var includeRefs = self.query.include_refs === 'true';

      checkPermissions(this, resource, ACTIONS.load).then(function() {
        return resource.load(self.params.id);

      }).then(function(result) {
        if (!includeRefs) {
          return result;
        }
        return resource.cores.fetchDocRefs(result);

      }).then(function(result) {
        return runHandler(self, resource, handlers[ACTIONS.load], result);

      }).then(function(result) {
        self.reply(result);

      }).fail(function(err) {
        self.reply(updateErrorCode(err));
      });
    },


    getView: function(viewName) {
      return function() {

        var self = this;
        var includeRefs = self.query.include_refs === 'true';
        if (self.query.keys) self.query.keys = JSON.parse(self.query.keys);

        checkPermissions(this, resource, ACTIONS.views).then(function() {
          return resource.view(viewName, self.query);

        }).then(function(result) {
          if (!includeRefs) {
            return result;
          }
          var docs = [];
          if (self.query.include_docs) {
            // use included docs
            docs = result.rows.map(function(row) { return row.doc; });
          }
          else {
            // use view values
            docs = result.rows.map(function(row) { return row.value; });
          }
          return resource.cores.fetchDocsRefs(docs).then(function(docs) {
            // return view result instead of docs array,
            // docs array contains references to the rows docs in the result
            return result;
          });

        }).then(function(result) {
          return runHandler(self, resource, handlers[ACTIONS.views], result);

        }).then(function(result) {
          self.reply(result);

        }).fail(function(err) {
          self.reply(updateErrorCode(err));
        });
      };
    },


    save: function() {

      var self = this;

      checkPermissions(this, resource, ACTIONS.create).then(function() {
        var doc = parseSavePayload(self, name);
        return runHandler(self, resource, handlers[ACTIONS.create], doc);

      }).then(function(result) {
        return handleSave(self, resource, result);
      }).fail(function(err) {
        handleError(self, err);
      });
    },


    saveWithId: function() {

      var self = this;

      checkPermissions(this, resource, ACTIONS.create).then(function() {
        var doc = parseSavePayload(self, name);
        if (doc._rev) {
          // prevent update, updates should put to /{id}/{rev}
          var err = new Error('Doc with _rev not allowed');
          err.code = 400;
          throw err;
        }
        doc._id = self.params.id;
        return runHandler(self, resource, handlers[ACTIONS.create], doc);

      }).then(function(result) {
        handleSave(self, resource, result);

      }).fail(function(err) {
        handleError(self, err);
      });
    },


    update: function() {
      var self = this;

      checkPermissions(this, resource, ACTIONS.update).then(function() {
        var doc = parseSavePayload(self, name);
        doc._id = self.params.id;
        doc._rev = self.params.rev;
        return runHandler(self, resource, handlers[ACTIONS.update], doc);

      }).then(function(doc) {
        handleSave(self, resource, doc);

      }).fail(function(err) {
        handleError(self, err);
      });
    },


    destroy: function() {
      var self = this;

      checkPermissions(this, resource, ACTIONS.destroy).then(function() {
        var docId = { type_: name, _id: self.params.id, _rev: self.params.rev };
        return runHandler(self, resource, handlers[ACTIONS.destroy], docId);

      }).then(function(docId) {
        return resource.destroy(docId);

      }).then(function() {
        self.reply();

      }).fail(function(err) {
        self.reply(updateErrorCode(err));
      });
    }
  };
};
