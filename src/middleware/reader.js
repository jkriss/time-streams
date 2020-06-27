const querystring = require('querystring')
const LinkHeader = require('http-link-header')
const URL = require('url')
const express = require('express')
const cors = require('cors')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const { findStream } = require('./shared')
const { getFormData } = require('./multipart')

dayjs.extend(utc)

const TIME_STREAMS_VERSION = '1'

function readerMiddleware(basePath) {

  const router = express.Router()

  router.use(cors({
    allowedHeaders: ['Authorization', 'If-None-Match'],
    exposedHeaders: ['Link', 'Time-Streams-Version', 'Post-Time']
  }))

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
      if (file.etag) res.set('ETag', file.etag)

      const previousFile = await stream.getPrevious(file.id)

      var link = new LinkHeader()
      link.set({
        rel: 'self',
        uri: file.id
      })
      if (previousFile) {
        link.set({
          rel: 'previous',
          uri: previousFile.id
        })
      }
      res.set('Link', link.toString())

      if (req.get('If-None-Match') && req.get('If-None-Match') === file.etag) {
        return res.status(304).send()
      }
      const fileStream = file.getStream()
      fileStream.on('end', () => res.end())
      fileStream.pipe(res)
    } else {
      res.status(404).send('Not Found')
    }
  }

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
      if (post) {
        res.set('Time-Streams-Version', TIME_STREAMS_VERSION)

        if (req.get('Accept') && req.get('Accept').includes('multipart/form-data')) {
          // send a multipart stream
          // TODO add an option for max items (via header?)
          const max = 50
          const form = await getFormData({ stream, post, max })

          res.set(form.getHeaders())
          form.pipe(res)

        } else {
          sendStreamFile(req, res, post, stream)
        }
      } else {
        next()
      }
    } else {
      next()
    }
  })

  return router
}

function parseDate(val) {
  if (!val) return undefined
  if (val.match(/^\d+$/)) val = parseInt(val)
  return new dayjs.utc(val).toDate()
}

module.exports = readerMiddleware
