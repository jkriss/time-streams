const express = require('express')
const reader = require('./middleware/reader')
const writer = require('./middleware/writer')

const app = express()

const webroot = 'public'

app.use(reader(webroot))
app.use(writer(webroot))
app.use(express.static(webroot))

const listener = app.listen(process.env.PORT, () => {
  console.log("Listening at http://localhost:" + listener.address().port);
});
