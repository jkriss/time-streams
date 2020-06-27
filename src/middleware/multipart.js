const LinkHeader = require('http-link-header')
const FormData = require('form-data')
const { getURI } = require('./shared')

const CRLF = '\r\n'


async function getFormData(req, { stream, post, max=50 }) {

  const form = new FormData()

  let count = 0

  do {

    const link = new LinkHeader()

    link.set({
      rel: 'self',
      uri: getURI(req, { stream, post })
    })

    const previous = await stream.getPrevious(post.id)

    if (previous) {
      link.set({
        rel: 'previous',
        uri: getURI(req, { stream, post: previous })
      })
    }

    const headers = [
      `Content-Disposition: form-data; name="${post.id}""`,
      `Content-Type: ${post.contentType}`,
      `Known-Length: ${post.contentLength}`,
      `Post-Time: ${post.date.toUTCString()}`,
      `Link: ${link.toString()}`
    ]

    const options = {
      header: CRLF + '--' + form.getBoundary() + CRLF + headers.join(CRLF) + CRLF + CRLF,
      knownLength: post.contentLength
    }
    form.append(post.id, post.getStream(), options)
    count++
    post = previous
  } while (count <= max && post)

  return form
}

module.exports = { getFormData }
