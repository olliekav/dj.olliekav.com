/* eslint-disable */
let Parser = require('rss-parser');
const fetch = require('node-fetch')
let parser = new Parser();
exports.handler = async function(event, context) {
  try {
    const response = await fetch('https://feeds.soundcloud.com/users/soundcloud:users:1394765/sounds.rss')
    if (!response.ok) {
      // NOT res.status >= 200 && res.status < 300
      return { statusCode: response.status, body: response.statusText }
    }
    const xml = await response.text()
    const data = await parser.parseString(xml)
    return {
      statusCode: 200,
      body: JSON.stringify({ feed: data.items })
    }
  } catch (err) {
    console.log(err) // output to netlify function log
    return {
      statusCode: 500,
      body: JSON.stringify({ msg: err.message }) // Could be a custom message or object i.e. JSON.stringify(err)
    }
  }
}
