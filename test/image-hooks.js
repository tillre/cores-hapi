module.exports = function(comodl) {

  return {
    save: function(payload, callback) {
      if (payload.multipart) {
        callback(null, payload.doc);
      }
      else {
        callback(null, payload);
      }
    }
  };
  
};