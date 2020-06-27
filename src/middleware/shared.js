const fs = require('fs-extra')
const path = require('path')
const URL = require('url')
const Store = require('../file-store')

const SUFFIX = '.timestream'

function getURI(req, { stream, post }) {
  const reqPath = URL.parse(req.url).pathname
  const streamName = path.basename(stream.root)
  return reqPath.endsWith(streamName) ? [streamName, post.id].join('/') : post.id
}

async function findStream(basePath, url, req) {
  const isRoot = await fs.pathExists(path.join(basePath, url.pathname.slice(1)+SUFFIX))
  let isPost
  let stream
  let streamID
  let id

  // is this path a timestream root?
  if (isRoot) {
    stream = new Store(path.join(basePath, url.pathname.slice(1)))
  } else {

    // or is it a post within a timestream root?
    const parentPath = path.dirname(url.pathname.slice(1))
    isPost = await fs.pathExists(path.join(basePath, parentPath+SUFFIX))

    if (isPost) {
      stream = new Store(path.join(basePath, parentPath))
      id = path.basename(url.pathname)
    }

  }

  if (stream) streamID = path.basename(stream.root)

  return {
    stream,
    id,
    streamID
  }

}

module.exports = {
  findStream,
  getURI
}
