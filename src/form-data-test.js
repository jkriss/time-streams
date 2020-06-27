const path = require('path')
const FormData = require('form-data')
const LinkHeader = require('http-link-header')
const Store = require('./file-store')
const express = require('express')

const CRLF = '\r\n'

// so, send this stream for any request with Accept: multipart/form-data,
// whether it's the stream base or an id?

// allow specifying a max? certainly enforce a max, regardless.

// can parse the whole stream in one go with res.formData() in the client.
// can also walk through the stream, though, and parse them individually.
// the latter is more complicated, but gives the option to cancel reading,
// skip larger streams, and other fun stuff.

async function getForm() {
  const stream = new Store('public/posts')
  let post = await stream.before()
  console.log("post:", post)

  const form = new FormData()

  const max = 2
  let count = 0

  do {

    const link = new LinkHeader()

    link.set({
      rel: 'self',
      uri: post.id
    })

    const previous = await stream.getPrevious(post.id)

    if (previous) {
      link.set({
        rel: 'previous',
        uri: previous.id
      })
    }

    const headers = [
      `Content-Disposition: form-data; name="${post.id}"; filename="${path.basename(post._.filename)}"`,
      `Content-Type: ${post.contentType}`,
      `Known-Length: ${post.contentLength}`,
      `Post-Time: ${post.date.toUTCString()}`,
      `Time-Streams-Version: 1`,
      `Link: ${link.toString()}`
    ]

    const options = {
      header: CRLF + '--' + form.getBoundary() + CRLF + headers.join(CRLF) + CRLF + CRLF,
      knownLength: post.contentLength
    }
    form.append(post.id, post.getStream(), options)
    count++
    post = previous
  } while (count < max && post)

  return form
}

const app = express()

app.get('/posts', async (req, res) => {
  const form = await getForm()
  res.set(form.getHeaders())
  form.pipe(res)
})

app.use(express.static('src/form-test'))

app.listen(9999)

// getForm().then(form => {
//   console.log(form.getHeaders())
//   form.pipe(process.stdout)
// })
