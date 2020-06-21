const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const { generateSecret, getStreamID, verify } = require('./auth')
const Store = require('./stores/file-store')
const { parseDate, toUnixTime } = require('./dates')

const app = express()

app.use(cors({
  allowedHeaders: ['Authorization', 'If-None-Match'],
  exposedHeaders: ['Date']
}))

const rawParser = bodyParser.raw({ type: '*/*', limit: '100mb' })
const textParser = bodyParser.text()
const jsonParser = bodyParser.json()

function sendStreamFile(req, res, file) {
  if (file) {
    res.set('Date', file.date.toUTCString())
    res.set('Content-Type', file.contentType)
    if (file.etag) res.set('ETag', file.etag)
    if (req.get('If-None-Match') && req.get('if-none-match') === file.etag) {
      return res.status(304).send()
    }
    const fileStream = file.getStream()
    fileStream.on('end', () => res.end())
    fileStream.pipe(res)
  } else {
    res.status(404).send('Not Found')
  }
}

//////////// reading

app.get("/streams/:streamID", async (req, res) => {
  const stream = new Store(req.params.streamID)
  const before = req.query.before ? toUnixTime(parseDate(req.query.before)) : null
  const file = await stream.before(before)
  sendStreamFile(req, res, file)
})

app.get("/streams/:streamID/:time", async (req, res) => {
  const stream = new Store(req.params.streamID)
  const date = parseDate(req.params.time)
  const file = await stream.get(toUnixTime(date))
  sendStreamFile(req, res, file)
})

//////////// posting

function streamAuthorization(req, res, next) {
  const { streamID } = req.params
  const secret = req.headers['authorization'] && req.headers['authorization'].split(' ')[1]
  const allowed = verify({ secret, streamID })
  if (!allowed) {
    return res.status(401).send('Not authorized')
  } else {
    next()
  }
}

app.post("/streams/:streamID", streamAuthorization, jsonParser, textParser, rawParser, async (req, res, next) => {
  const stream = new Store(req.params.streamID)
  if (JSON.stringify(req.body) === '{}') {
    res.status(400).send(`Bad request body and/or content type (${req.headers['content-type']})`)
    return
  }
  try {
    await stream.save({ body: req.body, contentType: req.headers['content-type'] })
  } catch (err) {
    return next(err)
  }
  return res.send('Ok')
})

//////////// start the server

const listener = app.listen(process.env.PORT, () => {
  console.log("Listening at http://localhost:" + listener.address().port);
});
