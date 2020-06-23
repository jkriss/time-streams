const URL = require('url')
const express = require('express')
const bodyParser = require('body-parser')
const { findStream } = require('./shared')
const { verify } = require('./auth')

function isAllowed(req, streamID) {
  const secret = req.headers['authorization'] && req.headers['authorization'].split(' ')[1]
  return verify({ secret, streamID })
}

function writerMiddleware(basePath) {

  const router = express.Router()

  router.use(bodyParser.raw({ type: '*/*', limit: '100mb' }))
  router.use(bodyParser.text())
  router.use(bodyParser.json())

  router.use(async (req, res, next) => {
    if (req.method !== 'POST') return next()
    const url = URL.parse(req.url)
    const { stream, streamID } = await findStream(basePath, url, req)
    if (stream) {
      const allowed = isAllowed(req, streamID)
      if (!allowed) {
        return res.status(401).send('Not authorized')
      } else {
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
      }
    } else {
      next()
    }
  })

  return router
}

module.exports = writerMiddleware
