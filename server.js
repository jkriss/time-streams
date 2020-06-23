const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const LinkHeader = require('http-link-header')
const { generateSecret, getStreamID, verify } = require('./auth')
const Store = require('./stores/file-store')

const app = express()

app.use(cors({
  allowedHeaders: ['Authorization', 'If-None-Match'],
  exposedHeaders: ['Date', 'Link']
}))

const rawParser = bodyParser.raw({ type: '*/*', limit: '100mb' })
const textParser = bodyParser.text()
const jsonParser = bodyParser.json()

async function sendStreamFile(req, res, file, stream) {
  if (file) {
    res.set('Date', file.date.toUTCString())
    res.set('Content-Type', file.contentType)
    if (file.etag) res.set('ETag', file.etag)

    const previousFile = await stream.getPrevious(file.id)

    var link = new LinkHeader()
    link.set({
      rel: 'self',
      uri: `/streams/${file.pathname}`
    })
    if (previousFile) {
      link.set({
        rel: 'previous',
        uri: `/streams/${previousFile.pathname}`
      })
    }
    res.set('Link', link.toString())

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

function parseDate(val) {
  if (!val) return undefined
  if (val.match(/^\d+$/)) val = parseInt(val)
  return new Date(val)
}

//////////// reading

app.get("/streams/:streamID", async (req, res) => {
  const stream = new Store(req.params.streamID)
  const file = await stream.before(parseDate(req.query['ts.before']))
  sendStreamFile(req, res, file, stream)
})

app.get("/streams/:streamID/:id", async (req, res) => {
  const stream = new Store(req.params.streamID)
  const file = await stream.get(req.params.id)
  sendStreamFile(req, res, file, stream)
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
