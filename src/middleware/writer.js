const URL = require('url')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const { findStream } = require('./shared')
const Store = require('../file-store')

function writerMiddleware(basePath, { maxFileSize, createIfMissing }={}) {

  const router = express.Router()

  if (!maxFileSize) maxFileSize = '100mb'

  router.use(bodyParser.raw({ type: '*/*', limit: maxFileSize }))
  router.use(bodyParser.text())
  router.use(bodyParser.json())

  router.use(async (req, res, next) => {
    if (req.method !== 'POST') return next()
    const url = URL.parse(req.url)
    let { stream, streamID } = await findStream(basePath, url, req)

    if (!stream && createIfMissing) {
      streamID = path.basename(url.pathname)
      stream = new Store(path.join(basePath, streamID))
    }

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
