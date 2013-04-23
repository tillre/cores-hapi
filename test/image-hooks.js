module.exports = {
  save: function(payload, callback) {
    if (payload.isMultipart) {
      callback(null, payload.doc);
    }
    else {
      callback(null, payload);
    }
  }
};
