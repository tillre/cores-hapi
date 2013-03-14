
module.exports = {

  views: {
    titles: {
      map: function(doc) {
        if (doc.type === 'Article') {
          emit(doc._id, doc.title);
        }
      },
      layout: function(cm, result, cb) {
        return result.rows.map(function(doc) {
          return doc.value;
        });
      }
    }
  }
  
};