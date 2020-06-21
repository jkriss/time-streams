const fs = require('fs-extra')
const path = require('path')
const sortArray = require('sort-array')
const mime = require('mime')
const dayjs = require('dayjs')
const fg = require('fast-glob')
const etag = require('etag')

const defaultRootPath = '.data'

const prefixFormat = 'YYYY/MM/DD'

function toUnixTime(date) {
  return Math.floor(date.getTime() / 1000)
}

class FileTimeStore {

  constructor(id, { rootPath }={}) {
    this.id = id
    this.rootPath = rootPath || defaultRootPath
    this.streamPath = path.join(this.rootPath, this.id)
    fs.ensureDirSync(this.rootPath)
  }

  pathForDate(date) {
    return path.join(this.rootPath, this.id, dayjs(date).format(prefixFormat))
  }

  prefixForTime(unixTime) {
    return path.join(this.pathForDate(new Date(unixTime*1000)), unixTime.toString())
  }

  async save({ body, contentType, date, overwrite }) {
    if (!date) date = new Date()
    const unixTime = toUnixTime(date)
    const name = unixTime.toString()
    let filepath = path.join(this.pathForDate(date), name)
    const ext = mime.getExtension(contentType)
    if (ext) filepath += '.' + ext
    const existingFile = await this.get(unixTime)
    if (existingFile && !overwrite) throw new Error('File already exists for this unix time')
    await fs.ensureDir(path.dirname(filepath))
    await fs.writeFile(filepath, body)
  }

  async get(unixTime) {
    const streamExists = await fs.pathExists(this.streamPath)
    if (!streamExists) return null
    const prefix = this.prefixForTime(unixTime)
    const paths = await fg([prefix+'.*'])
    if (paths[0]) {
      const [name, ext] = path.basename(paths[0]).split('.')
      const stat = await fs.stat(paths[0])
      return {
        date: new Date(parseInt(name)*1000),
        contentType: ext ? mime.getType(ext) : undefined,
        etag: etag(stat),
        getStream: () => {
          return fs.createReadStream(paths[0])
        },
        _: {
          filename: paths[0]
        }
      }
    }
  }

  async del(unixTime) {
    const existing = await this.get(unixTime)
    if (existing) {
      await fs.unlink(existing._.filename)
      return true
    }
    return false
  }

  async before(unixTime) {
    if (!unixTime) unixTime = toUnixTime(new Date())
    const date = new Date(unixTime*1000)
    let day = dayjs(date)
    // see which years we have data for
    const streamExists = await fs.pathExists(this.streamPath)
    if (!streamExists) return null
    const years = await fs.readdir(this.streamPath)
    const minYear = Math.min(...years.map(y => parseInt(y)))

    // iterate through the directories, starting from date
    while (day.year() >= minYear) {
      let prefix = this.pathForDate(new Date(day.valueOf()))
      const prefixExists = await fs.pathExists(prefix)
      if (prefixExists) {
        const paths = await fg([prefix+'/*']).then(p => p.sort().reverse())
        // return the first one that's before the given date
        for (const p of paths) {
          const t = parseInt(path.basename(p).split('.')[0])
          if (t < unixTime) return this.get(t)
        }
      }
      day = day.subtract(1, 'day')
    }
  }
}

if (require.main === module) {
  (async function() {

    const s = new FileTimeStore('example-stream')
    const date = new Date('2020-01-01')
    const unixTime = toUnixTime(date)
    console.log("unix time:", unixTime)
    await s.del(unixTime)
    await s.save({ body: 'hello!', contentType: 'text/plain', date })
    const f = await s.get(unixTime)
    console.log("saved", f)
    f.getStream().pipe(process.stdout)
  })()
}

module.exports = FileTimeStore
