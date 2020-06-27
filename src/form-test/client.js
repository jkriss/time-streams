(function() {

  const CRLF = '\r\n'
  const doubleBreak = new TextEncoder('ascii').encode(CRLF+CRLF)

  function createObjects (acc, p) {
    // rel="next" => 1: rel 2: next
    var m = p.match(/\s*(.+)\s*=\s*"?([^"]+)"?/)
    if (m) acc[m[1]] = m[2]
    return acc
  }

  function parseLink(link) {
    try {
      var m         =  link.match(/<?([^>]*)>(.*)/)
        , linkUrl   =  m[1]
        , parts     =  m[2].split(';')
      parts.shift()
      var info = parts
        .reduce(createObjects, {})
      info.url = linkUrl
      return info
    } catch (e) {
      return null
    }
  }

  function parseLinkHeader(header) {
    if (!header) return null
    const obj = {}
    header.split(/,\s*</)
     .map(parseLink)
     .forEach(link => obj[link.rel] = link)
    return obj
  }

  function boundaryAtIndex(array, b, idx) {
    for (let i=0; i<b.length; i++) {
      if (array[idx+i] !== b[i]) return false
    }
    return true
  }

  function getBoundaryIndexes(array, b, { first }={}) {
    const indexes = []
    for (let i=0; i<array.length-b.length; i++) {
      if (boundaryAtIndex(array, b, i)) {
        if (first) return i
        else indexes.push(i)
      }
    }
    return indexes
  }

  function parseHeaders(headers) {
    const h = new Headers()
    for (const line of headers.split(CRLF)) {
      const idx = line.indexOf(': ')
      const key = line.slice(0, idx)
      const val = line.slice(idx+2, line.length)
      h.append(key, val)
    }
    return h
  }

  async function getBulk(url) {
    const res = await fetch(url)
    const contentType = res.headers.get('content-type')
    const m = contentType.match(/multipart\/form-data; boundary=(.+)$/)
    const boundary = m[1]

    const bytesBoundary = new TextEncoder('ascii').encode(CRLF+'--'+boundary+CRLF)
    const endBytes = new TextEncoder('ascii').encode(CRLF+'--'+boundary+'--')

    const responses = []

    const reader = res.body.getReader()
    let finished = false
    const chunks = []
    while (!finished) {
      const { done, value } = await reader.read()
      if (value) chunks.push(value)
      finished = done
    }

    // save the whole stream
    const blob = new Blob(chunks)
    const buffer = await blob.arrayBuffer()
    const value = new Uint8Array(buffer)

    const boundaryIndexes = getBoundaryIndexes(value, bytesBoundary)
    do {
      const endIndex = boundaryIndexes[1] ? boundaryIndexes[0] : value.length-endBytes.length
      const entry = value.slice(boundaryIndexes.shift()+bytesBoundary.length, boundaryIndexes[0]-CRLF.length)
      if (entry.length !== 0) {
        const firstDouble = getBoundaryIndexes(entry, doubleBreak, { first: true })
        const headers = parseHeaders(new TextDecoder("utf-8").decode(entry.slice(0, firstDouble)))
        headers.append('content-length', headers.get('known-length'))
        headers.delete('known-length')
        const body = entry.slice(firstDouble+doubleBreak.length, entry.length)
        const blob = new Blob([body])
        responses.push(new Response(blob, { headers }))
      }

    } while (boundaryIndexes[0])
    return responses
  }

  window.TimeStreams = { getBulk, parseLinkHeader }

})()
