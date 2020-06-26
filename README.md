# time-streams

A super simple protocol for small scale, low volume, most-recent-first data feeds.

## Setup

    yarn install

## Example

Start the server:

    yarn dev

Then in another shell:

    curl -X POST -H "Authorization: Bearer devsekrit" -H "Content-Type: text/plain" --data "hi from curl" http://localhost:3333/posts

Now open http://localhost:3333/posts in your browser.

### Using the middleware

You can mount the reader and writer middleware independently.

```javascript
const express = require('express')
const { reader, writer } = require('time-streams')

const app = express()
const webroot = 'public'

app.use(reader(webroot))
app.use(writer(webroot, { createIfMissing: true }))

// serve regular files, too
app.use(express.static(webroot))

const listener = app.listen(process.env.PORT, () => {
  console.log("Listening at http://localhost:" + listener.address().port)
})
```

In practice, you'll likely want to protect writes somehow. This is one way:

```javascript
// need a secret to post (TIME_STREAM_SECRET environment variable)
app.use((req, res, next) => {
  if (req.method !== 'POST') return next()
  const authHeader = req.get('Authorization')
  if (authHeader) {
    const secret = authHeader.split(' ')[1]
    if (secret === process.env.TIME_STREAM_SECRET) {
      return next()
    }
  }
  return res.status(401).send('Not authorized')
})
```

## Using the file store

You can also use the file store directly.

```javascript
const { FileStore } = require('time-streams')

const stream = new FileStore('posts')

stream.save({
  body: 'test-message',
  contentType: 'text/plain'
})
```
