// An axios error as a short string for the log: the status and the start of the response body, or
// the network error code. Not the whole error, since error.config holds the url, params, headers
// and body of the request, which can contain API keys.
module.exports = function describeAxiosError(error) {
  // Some callers reject with a plain string
  if (error === null || typeof error !== 'object') return String(error);
  if (error.response) {
    const data = error.response.data;
    let body;
    if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) body = Buffer.from(data).toString();
    else body = typeof data === 'string' ? data : JSON.stringify(data);
    return `HTTP ${error.response.status} ${String(body).slice(0, 500)}`;
  }
  return error.code || error.message;
};
