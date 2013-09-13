var hapi = require('hapi');
var updateErrorCode = require('./update-error-code.js');

//
// run a handler for a resource action
// request, handler and response call order is:
//
// GET -> load doc -> call handler -> response
// POST/PUT -> call handler -> create/save doc -> response
// DELETE -> call handler -> destroy doc -> response
//
function runHandler(request, resource, handler, payload, callback) {

  if (handler) {
    handler(request, resource, payload, callback);
  }
  else {
    callback(null, payload);
  }
};

//
// check permissions for resource action
//

function checkPermissions(request, resource, action, callback) {

  if (request.auth &&
      request.auth.credentials &&
      request.auth.credentials.permissions) {

    var permissions = request.auth.credentials.permissions[resource.name];

    if (permissions && permissions[action]) {
      // permission granted
      return callback();
    }
    else {
      var err = new Error('Permission denied');
      err.code = 401;
      callback(err);
    }
  }
  else {
    callback();
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

  resource.save(doc, function(err, doc) {

    if (err) {
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

      return request.reply(updateErrorCode(err));
    }

    return request.reply(doc);
  });
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

      checkPermissions(this, resource, ACTIONS.load, function(err) {
        if (err) {
          return self.reply(updateErrorCode(err));
        }
        resource.load(self.params.id, function(err, result) {
          if (err) return self.reply(updateErrorCode(err));

          runHandler(self, resource, handlers[ACTIONS.load], result, function(err, result) {
            if (err) return self.reply(updateErrorCode(err));

            self.reply(result);
          });
        });
      });
    },


    getView: function(viewName, viewHandler) {
      return function() {
        var self = this;

        checkPermissions(this, resource, ACTIONS.views, function(err) {
          if (err) {
            return self.reply(updateErrorCode(err));
          }
          resource.view(viewName, self.query, function(err, docs) {
            if (err) return self.reply(updateErrorCode(err));

            runHandler(self, resource, handlers[ACTIONS.views], docs, function(err, result) {
              if (err) return self.reply(updateErrorCode(err));

              self.reply(result);
            });
          });
        });
      };
    },


    save: function() {

      var self = this;

      checkPermissions(this, resource, ACTIONS.create, function(err) {
        if (err) return self.reply(updateErrorCode(err));

        var doc = parseSavePayload(self, name);

        runHandler(self, resource, handlers[ACTIONS.create], doc, function(err, result) {
          if (err) return self.reply(updateErrorCode(err));

          handleSave(self, resource, result);
        });
      });
    },


    saveWithId: function() {

      var self = this;

      checkPermissions(this, resource, ACTIONS.create, function(err) {
        if (err) {
          return self.reply(updateErrorCode(err));
        }
        var doc = parseSavePayload(self, name);

        if (doc._rev) {
          // prevent update, updates should put to /{id}/{rev}
          var err = new Error('Doc with _rev not allowed');
          err.code = 400;
          return self.reply(err);
        }
        doc._id = self.params.id;

        runHandler(self, resource, handlers[ACTIONS.create], doc, function(err, result) {
          if (err) return self.reply(updateErrorCode(err));

          handleSave(self, resource, result);
        });
      });
    },


    update: function() {
      var self = this;

      checkPermissions(this, resource, ACTIONS.update, function(err) {
        if (err) {
          return self.reply(updateErrorCode(err));
        }
        var doc = parseSavePayload(self, name);

        doc._id = self.params.id;
        doc._rev = self.params.rev;

        runHandler(self, resource, handlers[ACTIONS.update], doc, function(err, result) {
          if (err) return self.reply(updateErrorCode(err));

          handleSave(self, resource, result);
        });
      });
    },


    destroy: function() {
      var self = this;

      checkPermissions(this, resource, ACTIONS.destroy, function(err) {
        if (err) return self.reply(updateErrorCode(err));

        var docId = { type_: name, _id: self.params.id, _rev: self.params.rev };

        runHandler(self, resource, handlers[ACTIONS.destroy], docId, function(err) {
          if (err) return self.reply(updateErrorCode(err));

          resource.destroy(docId, function(err) {
            if (err) return self.reply(updateErrorCode(err));

            self.reply();
          });
        });
      });
    }
  };
};
