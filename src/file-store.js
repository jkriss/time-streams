const fs = require('fs-extra')
const path = require('path')
const { ulid, decodeTime } = require('ulid')
const mime = require('mime')
const dayjs = require('dayjs')
const fg = require('fast-glob')
const etag = require('etag')

const prefixFormat = 'YYYY/MM/DD'
const dateIdFormat = 'YYYY-MM-DD'

function dateFromId(id) {
  let date
  try {
    date = new Date(decodeTime(id))
  } catch (err) {
    const idx = id.indexOf(':')
    const dateStr = id.slice(0,idx)
    const name = id.slice(idx+1)
    id = name
    date = dayjs(dateStr, dateIdFormat).toDate()
  }
  return { date, id }
}

function maybePrefixId(id, date) {
  try {
    decodeTime(id)
    return id
  } catch (err) {
    return dayjs(date).format(dateIdFormat) + ':' + id
  }
}

class FileTimeStore {

  constructor(root) {
    this.root = root
    this.streamPath = path.join(this.root+'.timestream')
  }

  pathForDate(date) {
    return path.join(this.streamPath, dayjs(date).format(prefixFormat))
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
    const d = dateFromId(id)
    const { date } = d
    const strippedId = d.id
    const pathPrefix = this.pathForDate(date)
    const paths = await fg([path.join(pathPrefix, strippedId+'*')])
    if (paths[0]) {
      const [name, ext] = path.basename(paths[0]).split('.')
      const stat = await fs.stat(paths[0])
      return {
        date,
        id,
        pathname: `${this.root}/${id}`,
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
    const d = dateFromId(id)
    const { date } = d
    const strippedId = d.id
    const prefix = this.pathForDate(date)
    const posts = await fg([prefix+'/*']).then(p => p.sort().reverse())
    let post
    if (posts.length > 1) {
      for (const i in posts) {
        if (posts[i].includes(strippedId)) {
          const postName = posts[parseInt(i)+1]
          if (postName) {
            const postId = path.basename(postName).split('.')[0]
            return this.get(maybePrefixId(postId, date))
          }
        }
      }
    }
    if (!post) {
      post = await this.before(date)
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
          let name = path.basename(p).split('.')[0]
          let t
          try {
            t = decodeTime(name)
          } catch (err) {
            // failed to get the file time from the filename, just use the directory day
            const dirDate = dayjs(day.format(prefixFormat), prefixFormat)
            t = dirDate.valueOf()
            name = maybePrefixId(name, dirDate)
          }
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
