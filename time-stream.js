// const fs = require('fs-extra')
const path = require('path')
const sortArray = require('sort-array')
const { ulid, decodeTime, encodeTime } = require('ulid')
const mime = require('mime')
const { toUnixTime } = require('./dates')

let s3

const bucketName = process.env.BUCKET_NAME || 'timestreams'

if (process.env.AWS_ACCESS_KEY || process.env.LOCAL_STORE) {
  console.log("-- using local file storage --")
  const AWS = require('mock-aws-s3')
  const rootPath = path.join(__dirname, '.data')
  AWS.config.basePath = rootPath
  s3 = AWS.S3({
      params: { Bucket: bucketName }
  })
} else {
  console.log("-- using s3 file storage --")
  const AWS = require('aws-sdk')
  let endpoint
  if (process.env.S3_ENDPOINT) {
    endpoint = new AWS.Endpoint(process.env.S3_ENDPOINT)
  }
  s3 = new AWS.S3({
    endpoint,
    params: { Bucket: bucketName }
  })
}

const streamStore = {}

function get(id) {
  let stream = streamStore[id]
  if (!stream) {
    stream = new TimeStream(id)
    streamStore[id] = stream
  }
  return stream
}


class TimeStream {

  constructor(id) {
    this.id = id
  }

  async exists() {
    // TODO how to tell if the bucket is created? need a special file?
    const res = await s3.listObjectsV2({ Prefix: `${this.id}/`}).promise()
    return !!res
  }

  async _files(prefix='') {
    let files = []
    let continuationToken
    let res
    do {
      res = await s3.listObjectsV2({ Prefix: `${this.id}/${prefix}`, ContinuationToken: continuationToken }).promise()
      files = files.concat(res.Contents)
      continuationToken = res.ContinuationToken
    } while (res.IsTruncated)
    const allFiles = files.map(f => {
      const name = f.Key.split('/')[1]
      const created = new Date(decodeTime(name.split('.')[0]))
      return {
        name,
        created,
        unixTime: toUnixTime(created),
        getStream: async () => {
          const objectRes = await s3.getObject({ Key: f.Key }).promise()
          return objectRes.Body
        }
      }
    })
    return sortArray(allFiles, { order: 'desc', by: 't', computed: { t: f => f.created.getTime() }})
  }

  async get(date) {
    const files = await this._files(encodeTime(date.getTime()))
    const unixTime = toUnixTime(date)
    return files.find(f => f.unixTime === unixTime)
  }

  async save(data, contentType) {
    const ext = mime.getExtension(contentType)

    const existingForDate = await this.get(new Date())
    if (existingForDate) throw new Error('Post already exists with this timestamp')

    const parts = [ulid()]
    if (ext) parts.push(ext)
    const filename = parts.join('.')
    const res = await s3.putObject({ Key: `${this.id}/${filename}`, Body: data }).promise()
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
  TimeStream,
  get
}

if (require.main === module) {
  (async function(){
    const stream = new TimeStream('K5BXQ5F5PFSNGJ09')
    console.log("files", await stream._files())
  })()
}
