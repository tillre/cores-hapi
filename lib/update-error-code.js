//
// unify error code property name or 500
//

module.exports = function updateErrorCode(err) {
  err.code = err.code || err.status_code || err.statusCode || 500;
  return err;
};
