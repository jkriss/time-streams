const fs = require('fs-extra')
const path = require('path')
const { ulid, decodeTime } = require('ulid')
const sortArray = require('sort-array')
const mime = require('mime')
const dayjs = require('dayjs')
const fg = require('fast-glob')
const etag = require('etag')

const defaultRootPath = '.data'

const prefixFormat = 'YYYY/MM/DD'

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

  async save({ body, contentType, date, overwrite }) {
    if (!date) date = new Date()
    const name = ulid(date.getTime())
    let filepath = path.join(this.pathForDate(date), name)
    const ext = mime.getExtension(contentType)
    if (ext) filepath += '.' + ext
    await fs.ensureDir(path.dirname(filepath))
    await fs.writeFile(filepath, body)
  }

  async get(id) {
    const streamExists = await fs.pathExists(this.streamPath)
    if (!streamExists) return null
    const pathPrefix = this.pathForDate(new Date(decodeTime(id)))
    const paths = await fg([path.join(pathPrefix, id+'*')])
    if (paths[0]) {
      const [name, ext] = path.basename(paths[0]).split('.')
      const stat = await fs.stat(paths[0])
      return {
        date: new Date(decodeTime(name)),
        id,
        pathname: `${this.id}/${id}`,
        // pathname: id,
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

  async getPrevious(id) {
    // check in the same dir for the next file
    // if this is the first file in the dir, then look up the the before this one
    const streamExists = await fs.pathExists(this.streamPath)
    if (!streamExists) return null
    const prefix = this.pathForDate(new Date(decodeTime(id)))
    const posts = await fg([prefix+'/*']).then(p => p.sort().reverse())
    let post
    if (posts.length > 1) {
      for (const i in posts) {
        if (posts[i].includes(id)) {
          const postName = posts[parseInt(i)+1]
          if (postName) {
            const postId = path.basename(postName).split('.')[0]
            return this.get(postId)
          }
        }
      }
    }
    if (!post) {
      post = await this.before(new Date(decodeTime(id)))
    }
    return post
  }

  async del(id) {
    const existing = await this.get(id)
    if (existing) {
      await fs.unlink(existing._.filename)
      return true
    }
    return false
  }

  async before(date) {
    if (!date) date = new Date()
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
          const name = path.basename(p).split('.')[0]
          const t = decodeTime(name)
          if (t < date.getTime()) return this.get(name)
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
    await s.save({ body: 'hello!', contentType: 'text/plain', date })
    const f = await s.before(new Date('2020-01-02'))
    console.log("saved", f)
    f.getStream().pipe(process.stdout)
  })()
}

module.exports = FileTimeStore
