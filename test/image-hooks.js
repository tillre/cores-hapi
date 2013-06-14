module.exports = {
  save: function(payload, callback) {
    if (payload.isMultipart) {
      callback(null, payload.doc);
    }
    else {
      console.log('no multi');
      callback(null, payload);
    }
  }
};
