const fs = require('fs-extra')
const path = require('path')
const mime = require('mime')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const customParseFormat = require('dayjs/plugin/customParseFormat')
const fg = require('fast-glob')
const etag = require('etag')
const { monotonicFactory } = require('ulid')

dayjs.extend(customParseFormat)
dayjs.extend(utc)

const ulid = monotonicFactory()

const prefixFormat = 'YYYY/MM/DD'.split('/').join(path.sep)
const timeFormat = 'HHmmss[Z]'
const dateIdFormat = `YYYYMMDDT${timeFormat}`
const timePathFormat = [prefixFormat, timeFormat].join(path.sep)

function _nameAndDate(id, format, { skipDateExtraction, skipExt }={}) {
  const idx = id.indexOf('-')
  const dateStr = id.slice(0, idx)
  // console.log("date str is", dateStr, "parsing with", format)
  const fullName = skipDateExtraction ? id : id.slice(idx+1)
  const date = dayjs.utc(dateStr, format).toDate()
  let name = fullName
  let ext
  if (!skipExt) {
    const dotIdx = fullName.lastIndexOf('.')
    name = fullName.slice(0, dotIdx)
    ext = fullName.slice(dotIdx+1)
  }
  return { date, name, ext }
}

function nameAndDateFromTimePath(timePath) {
  let parseResult
  // if we have a time component, parse with that format
  if (timePath.match(/((^|\/)\d{6}Z)-/)) {
    parseResult = _nameAndDate(timePath, timePathFormat)
  } else {
    parseResult = _nameAndDate(timePath, prefixFormat, { skipDateExtraction: true })
  }
  const parts = parseResult.name.split(path.sep)
  parseResult.name = parts[parts.length-1]
  // }
  return parseResult
}

function nameAndDateFromId(id) {
  return _nameAndDate(id, dateIdFormat, { skipExt: true })
}

function idFromNameAndDate({ date, name }) {
  const parts = [toIdDate(date)]
  if (name) parts.push(name)
  return parts.join('-')
}

function toIdDate(date) {
  return dayjs(date).utc().format(dateIdFormat)
}

function timePathFromDate(date) {
  // if it's a utc day, time zero, don't bother with the prefix
  return dayjs(date).utc().format(timePathFormat).replace(/000000Z$/,'')
}

function dayPathFromDate(date) {
  return dayjs(date).utc().format(prefixFormat)
}

function filePathPrefixForNameAndDate({ name, date }) {
  const timePrefix = timePathFromDate(date)

  const filenameParts = []
  filenameParts.push(timePrefix)
  filenameParts.push(name)
  return filenameParts.join(timePrefix.endsWith('/') ? '' : '-')
}

class FileStore {

  constructor(root) {
    this.root = root
    this.streamPath = path.join(this.root+'.timestream')
  }

  async getFilename(date, { name, contentType='application/octet-stream', overwrite }={}) {
    const ext = mime.getExtension(contentType)
    const timePrefix = timePathFromDate(date)
    const parts = [timePrefix]
    if (!timePrefix.endsWith('/')) parts.push('-')
    if (!name) name = ulid()
    parts.push(name)
    let prefix = path.join(this.streamPath, parts.join(''))
    if (!overwrite) {
      const existing = await fg([prefix+'.*'])
      // console.log("existing:", existing)
      if (existing.length > 0) {
        throw new Error('File with that timestamp and name already exists')
      }
    }
    return `${prefix}.${ext}`
  }

  pathForDate(date) {
    return path.join(this.streamPath, dayPathFromDate(date))
  }

  async getPath(p) {
    // const [name, ext] = path.basename(p).split('.')
    const { date, name, ext } = nameAndDateFromTimePath(p.slice(this.streamPath.length))
    const id = idFromNameAndDate({ name, date })
    const stat = await fs.stat(p)
    return {
      date,
      id,
      pathname: `${this.root}/${id}`,
      contentType: ext ? mime.getType(ext) : undefined,
      etag: etag(stat),
      contentLength: stat.size,
      lastModified: new Date(stat.mtimeMs),
      getStream: () => {
        return fs.createReadStream(p)
      },
      _: {
        filename: p
      }
    }
  }

  async get(id) {
    const { name, date } = nameAndDateFromId(id)
    const filepathWithoutExt = path.join(this.streamPath, filePathPrefixForNameAndDate({ name, date }))
    const paths = await fg([filepathWithoutExt+'*'])
    const p = paths[0]

    if (p) return this.getPath(p)
  }

  async del(id) {
    const existing = await this.get(id)
    if (existing) {
      await fs.unlink(existing._.filename)
      return true
    }
    return false
  }

  async save({ body, name, contentType, date, overwrite }) {
    const filename = await this.getFilename(date, { name, contentType, overwrite })
    await fs.ensureDir(path.dirname(filename))
    await fs.writeFile(filename, body)
    const newFile = nameAndDateFromTimePath(filename.slice(this.streamPath.length+1))
    return idFromNameAndDate(newFile)
  }

  async before(date) {
    if (!date) date = new Date()
    let day = dayjs.utc(date)
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
          const postMeta = nameAndDateFromTimePath(p)
          const t = postMeta.date.getTime()
          if (t < date.getTime()) return this.getPath(p)
        }
      }
      day = day.subtract(1, 'day')
    }
  }

  async getPrevious(id) {
    // check in the same dir for the next file
    // if this is the first file in the dir, then look up the the before this one
    const streamExists = await fs.pathExists(this.streamPath)
    if (!streamExists) return null
    const { date, name } = nameAndDateFromId(id)
    // console.log("checking for one before", date, name)
    const prefixPath = filePathPrefixForNameAndDate({ name, date })
    const fullPrefixPath = path.join(this.streamPath, prefixPath)
    const dayPath = path.join(this.streamPath, dayPathFromDate(date))
    // console.log("checking day bucket", dayPath)
    const posts = await fg([dayPath+'/*']).then(p => p.sort().reverse())
    // console.log("posts for this day", posts)
    let post
    if (posts.length > 1) {
      for (const i in posts) {
        if (posts[i].startsWith(fullPrefixPath)) {
          const previousPostPath = posts[parseInt(i)+1]
          if (previousPostPath) return this.getPath(previousPostPath)
        }
      }
    }
    if (!post) {
      post = await this.before(date)
    }
    return post
  }

}

module.exports = FileStore

if (require.main === module) {
  (async function() {

    const d = new Date('2020-06-23')
    // const d = new Date()
    const dateStr = toIdDate(d)
    console.log(d.toString(), "->", dateStr)
    // const filenamePrefix = timePathFromDate(d)
    // console.log(filenamePrefix)

    const stream = new FileStore('test')
    // const id = await stream.save({ date: d, body: 'hello!', name: 'test-post', contentType: 'text/plain', overwrite: true })
    const id = await stream.save({ date: d, body: 'hello!', name: 'test-post', contentType: 'text/plain', overwrite: true })
    // const id = await stream.save({ date: d, body: 'hello!', contentType: 'text/plain' })

    // await stream.save({ date: d, body: 'hello!', contentType: 'text/plain' })
    console.log("saved", id)

    const p = await stream.get(id)
    console.log("got", p)
    if (p) p.getStream().pipe(process.stdout)

    const latest = await stream.before()
    console.log("latest:", latest)

    const prev = await stream.getPrevious(id)
    console.log("previous:", prev)

  })()
}
