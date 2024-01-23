const axios = require('axios')
const app = require('express')()
const cors = require('cors')

app.use(cors())

// nodemon --env-file=.env index.js

const PORT = 8080

function is_numeric(str) {
  return /^\d+$/.test(str)
}

function is_letter(str) {
  return str.length === 1 && str.match(/[a-z]/i)
}

function convertToFormattedTitle(title) {
  let output_template = {
    episode_number: '',
    title: '',
    guest: '',
    series: '',
  }
  let unformattedTitle = String(title)
  let splittedTitle = unformattedTitle.split('|')

  let guest = splittedTitle[1].trim()

  let positionOfPound = unformattedTitle.indexOf('#')
  let ind = positionOfPound + 1
  let episodeNumber = ''
  while (is_numeric(unformattedTitle[ind])) {
    episodeNumber += unformattedTitle[ind]
    ind++
  }
  if (Number(episodeNumber) < 10) {
    episodeNumber = '0' + episodeNumber
  }

  let formattedTitle = splittedTitle[0].substring(ind).trim()

  let series = ''
  let titleLowerCase = formattedTitle.toLowerCase()
  if (titleLowerCase.includes('net zero future')) {
    series = 'Net Zero Future'

    formattedTitle =
      formattedTitle.substring(0, titleLowerCase.indexOf('net zero future')) +
      formattedTitle.substring(titleLowerCase.indexOf('net zero future') + 'net zero future'.length)

    let tempInd = 0

    while (!is_letter(formattedTitle[tempInd])) {
      tempInd++
    }
    formattedTitle = formattedTitle.substring(tempInd)
  } else if (titleLowerCase.includes('dark matter uncovered')) {
    series = 'Dark Matter Uncovered'

    formattedTitle =
      formattedTitle.substring(0, titleLowerCase.indexOf('dark matter uncovered')) +
      formattedTitle.substring(
        titleLowerCase.indexOf('dark matter uncovered') + 'dark matter uncovered'.length,
      )
    let tempInd = 0

    while (!is_letter(formattedTitle[tempInd])) {
      tempInd++
    }
    formattedTitle = formattedTitle.substring(tempInd)
  } else {
    series = 'Business Podcast'
  }

  output_template.episode_number = episodeNumber
  output_template.title = formattedTitle
  output_template.guest = guest
  output_template.series = series
  return output_template
}

let temp = process.env.TRANSISTOR_API_KEY

const TRANSISTOR_API_KEY = temp.substring(1, temp.length - 1)

app.get('/test', (req, res) => {
  res.send('ABOBA')
})

// '/episode/1525237?formatted=true'
app.get('/episode/:episode_id', async function (req, res) {
  const EPISODE = req.params.episode_id
  let formatted = req.query.formatted.toLowerCase()
  res.statusCode = 200

  let output = {
    status: 'success',
  }

  //check if formatted
  if (formatted != 'true' && formatted != 'false') {
    res.statusCode = 400
    output.status = 'failure'
    output.message = 'invalid {formatted} param'
    res.send(output)
    return
  }

  if (formatted == 'true') {
    formatted = true
  } else {
    formatted = false
  }

  //episode number pattern check
  if (!is_numeric(EPISODE)) {
    res.statusCode = 400
    output.status = 'failure'
    output.message = 'invalid episode id'
    res.send(output)
    return
  }

  let request_output = null

  await axios
    .get(
      'https://api.transistor.fm/v1/episodes/' +
        EPISODE +
        '?fields[episode][]=title&fields[episode][]=share_url',
      {
        headers: {
          'x-api-key': TRANSISTOR_API_KEY,
        },
      },
    )
    .then((transistor_response) => {
      if (transistor_response.status == 200) {
        request_output = transistor_response.data.data.attributes
      } else {
        res.statusCode = 400
        output.status = 'failure'
        output.message = 'transistor.fm responded with invalid http code'
      }
    })
    .catch((err) => {
      res.statusCode = 400
      output.status = 'failure'
      output.message = 'exception occured during axios request'
    })

  if (request_output == null) {
    res.send(output)
    return
  }

  //reformatting the output if asked by the user
  if (formatted == true) {
    let shareurl = request_output.share_url
    let iframeurl = String(shareurl)
    iframeurl = iframeurl.split('')
    iframeurl[28] = 'e'
    iframeurl = iframeurl.join('')
    request_output = convertToFormattedTitle(request_output.title)
    request_output.url = {
      share: shareurl,
      iframe: iframeurl,
    }
  }

  output.data = request_output
  res.send(output)
})

app.get('/last-episode', async function (req, res) {
  let formatted = req.query.formatted.toLowerCase()
  res.statusCode = 200

  let output = {
    status: 'success',
  }

  //check if formatted
  if (formatted != 'true' && formatted != 'false') {
    res.statusCode = 400
    output.status = 'failure'
    output.message = 'invalid {formatted} param'
    res.send(output)
    return
  }

  if (formatted == 'true') {
    formatted = true
  } else {
    formatted = false
  }

  let request_output = null

  await axios
    .get(
      'https://api.transistor.fm/v1/episodes?fields[episode][]=title&fields[episode][]=share_url&pagination[page]=1&pagination[per]=1',
      {
        headers: {
          'x-api-key': TRANSISTOR_API_KEY,
        },
      },
    )
    .then((transistor_response) => {
      if (transistor_response.status == 200) {
        request_output = transistor_response.data.data[0].attributes
        request_output.id = transistor_response.data.data[0].id
      } else {
        res.statusCode = 400
        output.status = 'failure'
        output.message = 'transistor.fm responded with invalid http code'
      }
    })
    .catch((err) => {
      res.statusCode = 400
      output.status = 'failure'
      output.message = 'exception occured during axios request'
    })

  if (request_output == null) {
    res.send(output)
    return
  }

  //reformatting the output if asked by the user
  if (formatted == true) {
    let shareurl = request_output.share_url
    let id = request_output.id
    let iframeurl = String(shareurl)
    iframeurl = iframeurl.split('')
    iframeurl[28] = 'e'
    iframeurl = iframeurl.join('')
    request_output = convertToFormattedTitle(request_output.title)
    request_output.url = {
      share: shareurl,
      iframe: iframeurl,
    }
    request_output.id = id
  }

  output.data = request_output
  res.send(output)
})

app.listen(PORT, () => {
  console.log('API READY')
})
