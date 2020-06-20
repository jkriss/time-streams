require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const mime = require('mime')
const { generateSecret, getStreamID, verify } = require('./auth')
const { get } = require('./time-stream')
const { parseDate } = require('./dates')

const app = express();

const rawParser = bodyParser.raw({ type: '*/*', limit: '100mb' })
const textParser = bodyParser.text()
const jsonParser = bodyParser.json()

async function sendStreamFile(res, file) {
  if (file) {
    res.set('Date', file.created.toUTCString())
    // res.sendFile(file.path)
    const body = await file.getStream()
    res.set('Content-Type', mime.getType(file.name))
    res.send(body)
  } else {
    res.status(404).send('Not Found')
  }
}

//////////// reading

app.get("/streams/:streamID", async (req, res) => {
  const stream = get(req.params.streamID)
  const before = req.query.before ? parseDate(req.query.before) : null
  const file = await stream.fileBefore(before)
  sendStreamFile(res, file)
})

app.get("/streams/:streamID/:time", async (req, res) => {
  const stream = get(req.params.streamID)
  const time = parseDate(req.params.time)
  const file = await stream.get(time)
  sendStreamFile(res, file)
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
  const stream = get(req.params.streamID)
  if (JSON.stringify(req.body) === '{}') {
    res.status(400).send(`Bad request body and/or content type (${req.headers['content-type']})`)
    return
  }
  try {
    await stream.save(req.body, req.headers['content-type'])
  } catch (err) {
    return next(err)
  }
  return res.send('Ok')
})

//////////// start the server

const listener = app.listen(process.env.PORT, () => {
  console.log("Listening at http://localhost:" + listener.address().port);
});
