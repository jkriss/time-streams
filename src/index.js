const reader = require('./middleware/reader')
const writer = require('./middleware/writer')
const FileStore = require('./file-store')

module.exports = {
  reader,
  writer,
  FileStore
}
