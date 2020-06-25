const querystring = require('querystring')
const LinkHeader = require('http-link-header')
const URL = require('url')
const express = require('express')
const cors = require('cors')
const { findStream } = require('./shared')

const TIME_STREAMS_VERSION = '1'

function readerMiddleware(basePath) {

  const router = express.Router()

  router.use(cors({
    allowedHeaders: ['Authorization', 'If-None-Match'],
    exposedHeaders: ['Link', 'Time-Streams-Version', 'Post-Time']
  }))


  router.use(async (req, res, next) => {
    if (req.method !== 'GET') return next()
    const url = URL.parse(req.url)
    const qs = querystring.parse(url.query)
    const { stream, id } = await findStream(basePath, url, req)
    if (stream) {
      let post
      if (id) {
        post = await stream.get(id)
      } else {
        post = await stream.before(parseDate(qs['before']))
      }
      req._timestreamBasePath = basePath === '.' ? '' : basePath
      if (post) {
        sendStreamFile(req, res, post, stream)
      } else {
        next()
      }
    } else {
      next()
    }
  })

  return router
}

async function sendStreamFile(req, res, file, stream) {
  if (file) {
    res.set('Content-Type', file.contentType)
    res.set('Post-Time', file.date.toUTCString())
    if (file.contentLength) {
      res.set('Content-Length', file.contentLength)
    }
    if (file.lastModified) {
      res.set('Last-Modified', file.lastModified.toUTCString())
    }
    res.set('Time-Streams-Version', TIME_STREAMS_VERSION)
    if (file.etag) res.set('ETag', file.etag)

    const previousFile = await stream.getPrevious(file.id)

    var link = new LinkHeader()
    link.set({
      rel: 'self',
      uri: file.pathname.slice(req._timestreamBasePath.length)
    })
    if (previousFile) {
      link.set({
        rel: 'previous',
        uri: previousFile.pathname.slice(req._timestreamBasePath.length)
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

module.exports = readerMiddleware
