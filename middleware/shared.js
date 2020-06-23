const fs = require('fs-extra')
const path = require('path')
const Store = require('./file-store')

const SUFFIX = '.timestream'

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
  findStream
}
