const request = require('request-promise-native');
const express = require('express');
const cheerio = require('cheerio');
const chrono = require('chrono-node');

const app = express();

const parseSchedule = dateString => {
  process.env.TZ = 'Europe/Paris';
  const parsed = dateString.split(',').map(item => item.trim());
  const date = parsed[0] + ' ' + parsed[1] + ' ' + parsed[2];
  const duration = parseInt(parsed[3].replace('minutes', '').trim());

  return {
    starts: chrono.parseDate(date),
    duration: duration
  };
};

app.get('/', (req, res) => {
  res.json({
    message: 'ElmEurope page scraper API',
    services: {
      speakers: {
        uri: '/speakers',
        methods: ['GET'],
        description: 'Retrieves the list of Elm Europe conference speakers'
      },
      schedule: {
        uri: '/schedule',
        methods: ['GET'],
        description: 'Retrieves the list of Elm Europe conference talks'
      }
    }
  });
});

app.get('/speakers', (req, res, next) => {
  request('https://elmeurope.org')
    .then(htmlString => {
      const $ = cheerio.load(htmlString);

      const speakers = $('.flex-speakers-container .speaker')
        .map((i, speaker) => ({
          name: $(speaker).find('.media-heading a').text(),
          image: $(speaker).find('.img-circle').attr('data-src'),
          bio: $(speaker).find('.media-sub').next().text()
        }))
        .get();

      res.json(speakers);
    })
    .catch(err => {
      next(err);
    });
});

app.get('/schedule', (req, res, next) => {
  request('https://elmeurope.org')
    .then(htmlString => {
      const $ = cheerio.load(htmlString);

      const items = $('.timeline .timeline-panel')
        .map((i, item) => {
          const schedule = parseSchedule($(item).find('.text-muted').text());

          return {
            title: $(item).find('.timeline-title').text(),
            speaker: $(item).find('.timeline-heading').children().last().text(),
            description: $(item).find('.timeline-body').children().last().text(),
            starts: schedule.starts,
            duration: schedule.duration
          };
        })
        .get();

      res.json(items);
    })
    .catch(err => {
      next(err);
    });
});

app.get('*', (req, res, next) => {
  res.status(404).json({ error: 'Resourse not found' });
});

app.use((error, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(80, () => console.log('Listening on port 80'));
