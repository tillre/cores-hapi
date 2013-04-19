
module.exports = {

  views: {
    titles: {
      map: function(doc) {
        if (doc.type_ === 'Article') {
          emit(doc._id, doc.title);
        }
      },
      layout: function(cm, result, cb) {
        cb(null, result.rows.map(function(doc) {
          return doc.value;
        }));
      }
    }
  }
  
};