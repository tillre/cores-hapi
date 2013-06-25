
module.exports = {

  create: function(request, resource, doc, callback) {
    doc.createdHandler = true;
    callback(null, doc);
  }
};