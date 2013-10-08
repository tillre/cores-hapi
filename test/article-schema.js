var j = require('jski');

module.exports = j.object({

  title: j.string().minLength(1),
  author: j.object({
    firstname: j.string(),
    lastname: j.string()
  }),
  tags: j.array(j.string()),
  body: j.string().minLength(1)

}).title('Article')
  .required('title', 'author', 'body');
