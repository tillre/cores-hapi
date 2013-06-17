         
function handlePayload(payload, callback) {
  if (payload.isMultipart) {
    callback(null, payload.doc);
  }
  else {
    console.log('no multi');
    callback(null, payload);
  }
}


module.exports = {
  create: handlePayload,
  update: handlePayload
};
