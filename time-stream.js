const fs = require('fs-extra')
const path = require('path')
const sortArray = require('sort-array')
const { ulid } = require("ulid")
const mime = require('mime')
const { toUnixTime } = require('./dates')

const rootPath = path.join(__dirname, '.data')


class TimeStream {

  constructor(id) {
    this.id = id
    fs.ensureDirSync(rootPath)
  }

  dir() {
    return path.join(rootPath, this.id)
  }

  async exists() {
    return fs.pathExists(this.dir())
  }

  async _files() {
    const exists = await this.exists()
    if (!exists) return []
    const files = await fs.readdir(this.dir())
    const dir = this.dir()
    const stats = await Promise.all(files.map(f => fs.stat(path.join(dir, f))))
    const fileInfo = stats.map((s, i) => {
      const created = new Date(s.ctime)
      return {
        name: files[i],
        path: path.join(dir, files[i]),
        created,
        unixTime: toUnixTime(created)
      }
    })
    return sortArray(fileInfo, { order: 'desc', by: 't', computed: { t: f => f.created.getTime() }})
  }

  async get(date) {
    const files = await this._files()
    const unixTime = toUnixTime(date)
    console.log("time:", unixTime)
    console.log("files:", files)
    return files.find(f => f.unixTime === unixTime)
  }

  async save(data, contentType) {
    const ext = mime.getExtension(contentType)
    const existingForDate = await this.get(new Date())
    if (existingForDate) throw new Error('Post already exists with this timestamp')
    const parts = [ulid()]
    if (ext) parts.push(ext)
    const filename = parts.join('.')
    await fs.writeFile(path.join(this.dir(), filename), data)
  }

  async fileBefore(date) {
    const files = await this._files()
    if (!date) return files[0]
    for (const f of files) {
      if (f.created < date) return f
    }
  }

}

module.exports = {
  TimeStream
}
