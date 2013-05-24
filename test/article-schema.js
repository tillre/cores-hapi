module.exports = {

  name: 'Article',
  description: 'Some Article',

  properties: {
    title: { type: 'string', minLength: 1 },
    author: {
      properties: {
        firstname: { type: 'string'},
        lastname: { type: 'string' }
      }
    },
    tags: {
      type: 'array',
      items: { type: 'string' }
    },
    body: { type: 'string', minLength: 1 }
  },
  required: ['title', 'author', 'body']
};
