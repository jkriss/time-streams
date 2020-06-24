const URL = require('url')
const express = require('express')
const bodyParser = require('body-parser')
const { findStream } = require('./shared')

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
    } else {
      next()
    }
  })

  return router
}

module.exports = writerMiddleware
