const axios = require('axios')
const app = require('express')()
const cors = require('cors')
const fs = require('node:fs')

app.use(cors())

// nodemon --env-file=.env index.js

let modelForCacheFile = {
  last_episode: {
    formatted: {
      data: {},
      last_update: '',
    },
    unformatted: {
      data: {},
      last_update: '',
    },
  },
  featured_episodes: {
    episodes_list: [],
    data: [],
    last_update: '',
  },
}

let modelForFeaturedEpisodes = {
  episodes_list: [],
}

if (fs.existsSync('cache.json')) {
  console.log('cache exists')
} else {
  console.log("cache doesn't exist")
  fs.writeFileSync('cache.json', JSON.stringify(modelForCacheFile, null, 2))
}

if (fs.existsSync('featured_episodes.json')) {
  console.log('featured episodes list exists')
} else {
  console.log("featured episodes list doesn't exist")
  fs.writeFileSync('featured_episodes.json', JSON.stringify(modelForFeaturedEpisodes, null, 2))
}

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

  if (formatted) {
    let cache = JSON.parse(fs.readFileSync('cache.json', 'utf-8'))
    let data = cache.last_episode.formatted.data
    let last_update = cache.last_episode.formatted.last_update
    let last_update_date = new Date(last_update)
    let currentDate = new Date()

    let diffMs = currentDate - last_update_date
    let diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000)
    if (
      Object.keys(data).length !== 0 &&
      String(last_update).length !== 0 &&
      diffMins >= 0 &&
      diffMins < 2
    ) {
      output.data = data
      res.send(output)
      return
    }
  } else {
    let cache = JSON.parse(fs.readFileSync('cache.json', 'utf-8'))
    let data = cache.last_episode.unformatted.data
    let last_update = cache.last_episode.unformatted.last_update
    let last_update_date = new Date(last_update)
    let currentDate = new Date()

    let diffMs = currentDate - last_update_date
    let diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000)
    if (
      Object.keys(data).length !== 0 &&
      String(last_update).length !== 0 &&
      diffMins >= 0 &&
      diffMins < 2
    ) {
      output.data = data
      res.send(output)
      return
    }
  }

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

  //reformatting the output & writing to the cache if asked
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
    let cache = JSON.parse(fs.readFileSync('cache.json', 'utf-8'))
    cache.last_episode.formatted.data = request_output
    let now = new Date()
    cache.last_episode.formatted.last_update = now
    fs.writeFileSync('cache.json', JSON.stringify(cache, null, 2))
  } else {
    let cache = JSON.parse(fs.readFileSync('cache.json', 'utf-8'))
    cache.last_episode.unformatted.data = request_output
    let now = new Date()
    cache.last_episode.unformatted.last_update = now
    fs.writeFileSync('cache.json', JSON.stringify(cache, null, 2))
  }

  output.data = request_output
  res.send(output)
})

app.get('/featured-episodes', function (req, res) {
  res.statusCode = 200

  let output = {
    status: 'success',
  }

  let episodes_list = JSON.parse(fs.readFileSync('featured_episodes.json', 'utf-8'))
  episodes_list = episodes_list.episodes_list
  let cache = JSON.parse(fs.readFileSync('cache.json', 'utf-8'))
  let cache_episodes_list = cache.featured_episodes.episodes_list

  let data = cache.featured_episodes.data
  let last_update = cache.featured_episodes.last_update
  let last_update_date = new Date(last_update)
  let currentDate = new Date()

  let diffMs = currentDate - last_update_date
  let diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000)
  //check if cache already has up-to-date information
  if (
    data.length !== 0 &&
    JSON.stringify(cache_episodes_list) == JSON.stringify(episodes_list) &&
    String(last_update).length !== 0 &&
    diffMins >= 0 &&
    diffMins < 6
  ) {
    output.data = data
    res.send(output)
    return
  }
  //check if featured episodes list has hanged since the last cache update
  if (JSON.stringify(cache_episodes_list) != JSON.stringify(episodes_list)) {
    cache.featured_episodes.episodes_list = episodes_list
  }

  let temp_data = []

  episodes_list.map(async function (featured_episode) {
    let request_output = null

    await axios
      .get(
        'https://api.transistor.fm/v1/episodes/' +
          featured_episode +
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
          output.message =
            'transistor.fm responded with invalid http code while trying to access data of episode ' +
            featured_episode
        }
      })
      .catch((err) => {
        res.statusCode = 400
        output.status = 'failure'
        output.message =
          'exception occured during axios request to data of episode ' + featured_episode
      })

    if (request_output == null) {
      res.send(output)
      error = true
      return
    }

    //reformatting the output
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
    request_output.id = featured_episode

    //pushing result to the array
    temp_data.push(request_output)
    //checking if it was the final iteration to start sorting
    if (temp_data.length == episodes_list.length) {
      //reordering in the original order
      let temp_sorted_data = []
      for (let i = 0; i < temp_data.length; i++) {
        let foundObject = temp_data.find((obj) => obj['id'] === episodes_list[i])
        temp_sorted_data.push(foundObject)
      }

      //saving the output to cache and sending reply to the user
      output.data = temp_sorted_data
      cache.featured_episodes.data = temp_sorted_data
      let now = new Date()
      cache.featured_episodes.last_update = now
      fs.writeFileSync('cache.json', JSON.stringify(cache, null, 2))

      res.send(output)
      return
    }
  })
})

app.listen(PORT, () => {
  console.log('API READY')
})
