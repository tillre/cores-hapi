var J = require('jski')();

module.exports = J.object({

  title: J.string().minLength(1),
  author: J.object({
    firstname: J.string(),
    lastname: J.string()
  }),
  tags: J.array(J.string()),
  body: J.string().minLength(1)

}).title('Article')
  .required('title', 'author', 'body');
