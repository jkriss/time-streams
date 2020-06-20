function parseDate(str) {
  const parsedInt = parseInt(str)
  if (parsedInt.toString() === str) {
    return new Date(parsedInt * 1000)
  } else {
    return new Date(str)
  }
}

function toUnixTime(date) {
  return Math.floor(date.getTime() / 1000)
}

module.exports = {
  parseDate,
  toUnixTime
}
