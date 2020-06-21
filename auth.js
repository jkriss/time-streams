const crypto = require("crypto");
const { ulid } = require("ulid");
const base32 = require("base32.js");

function generateSecret() {
  return ulid();
}

function getStreamID(secret) {
  if (typeof secret !== 'string' || secret.length !== 26) {
    return null
  }
  const hash = crypto.createHash('sha256');
  hash.update(secret)
  const buf = hash.digest().slice(0,10)
  const encoder = new base32.Encoder({ type: "crockford" });
  return encoder.write(buf).finalize();
}

function verify({ secret, streamID }) {
  const derivedStreamID = getStreamID(secret)
  return derivedStreamID && derivedStreamID === streamID
}

module.exports = {
  generateSecret,
  getStreamID,
  verify
}

if (require.main === module) {
  const secret = generateSecret()
  const streamID = getStreamID(secret)
  console.log(secret, '->', streamID)
}
