const axios = require('axios')
const app = require('express')()
const cors = require('cors')

app.use(cors())

// nodemon --env-file=.env index.js

const PORT = 8080

let temp = process.env.TRANSISTOR_API_KEY

const TRANSISTOR_API_KEY = temp.substring(1, temp.length - 1)

app.get('/test', (req, res) => {
  res.send('ABOBA')
})

app.get('/episodeinfo/:podcast_id', async function (req, res) {
  let podcast_id = req.params.podcast_id
  res.statusCode = 200
  let output = ''

  await axios
    .get('https://api.transistor.fm/v1/episodes/' + podcast_id, {
      headers: {
        'x-api-key': TRANSISTOR_API_KEY,
      },
    })
    .then((transistor_response) => {
      if (transistor_response.status == 200) {
        output = transistor_response.data.data
      } else {
        output = 'ERROR'
        res.statusCode = 404
      }
    })
    .catch((err) => {
      output = 'ERROR'
      res.statusCode = 404
    })

  res.send(output)
})

app.listen(PORT, () => {
  console.log('API READY')
})
