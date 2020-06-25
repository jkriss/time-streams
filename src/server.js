const express = require('express')
const compression = require('compression')
const { reader, writer } = require('../src/index')

const webroot = process.env.ROOT_DIR || '.'

const app = express()

app.use(compression())

// everybody can read
app.use(reader(webroot))

// need a secret to post (TIME_STREAM_SECRET environment variable)
app.use((req, res, next) => {
  if (req.method !== 'POST') return next()
  const authHeader = req.get('Authorization')
  if (authHeader) {
    const secret = authHeader.split(' ')[1]
    if (secret === process.env.TIME_STREAM_SECRET) {
      return next()
    }
  }
  return res.status(401).send('Not authorized')
})
app.use(writer(webroot, { createIfMissing: true }))

// serve regular files, too
app.use(express.static(webroot))

const listener = app.listen(process.env.PORT, () => {
  console.log("Listening at http://localhost:" + listener.address().port);
});
