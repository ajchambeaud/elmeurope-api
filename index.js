const request = require('request-promise-native');
const express = require('express');
const cheerio = require('cheerio');
const chrono = require('chrono-node');
const NodeCache = require('node-cache');
const pageCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

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

const getSpeakers = () => {
  const cachedSpeakers = pageCache.get('speakers');

  if (!cachedSpeakers) {
    return request('https://elmeurope.org').then(htmlString => {
      console.log('speakers response');
      const $ = cheerio.load(htmlString);

      const speakers = $('.flex-speakers-container .speaker')
        .map((i, speaker) => ({
          name: $(speaker).find('.media-heading a').text(),
          image: $(speaker).find('.img-circle').attr('data-src'),
          bio: $(speaker).find('.media-sub').next().text()
        }))
        .get();

      pageCache.set('speakers', speakers, 10000);

      return speakers;
    });
  }

  return Promise.resolve(cachedSpeakers);
};

const getSchedule = () => {
  const cachedSchedule = pageCache.get('schedule');

  if (!cachedSchedule) {
    return request('https://elmeurope.org').then(htmlString => {
      console.log('schedule response');
      const $ = cheerio.load(htmlString);

      const items = $('.timeline .timeline-panel')
        .map((i, item) => {
          const schedule = parseSchedule($(item).find('.text-muted').text());

          const scheduleItem = {
            title: $(item).find('.timeline-title').text(),
            speaker: $(item).find('.timeline-heading').children().last().text(),
            description: $(item).find('.timeline-body').children().last().text(),
            starts: schedule.starts,
            duration: schedule.duration
          };

          if (scheduleItem.speaker.trim() === '') {
            return {
              title: scheduleItem.title,
              starts: scheduleItem.starts,
              duration: scheduleItem.duration
            };
          }

          return scheduleItem;
        })
        .get();

      pageCache.set('schedule', items, 10000);

      return items;
    });
  }

  return Promise.resolve(cachedSchedule);
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
  return getSpeakers().then(speakers => res.json(speakers)).catch(err => next(err));
});

app.get('/schedule', (req, res, next) => {
  return Promise.all([getSpeakers(), getSchedule()])
    .then(([speakers, items]) => items.map(item => {
      if (!item.speaker) return item;

      const speaker = speakers.find(s => s.name === item.speaker);
      return Object.assign(item, { speaker });
    }))
    .then(items => res.json(items))
    .catch(err => next(err));
});

app.get('*', (req, res, next) => {
  res.status(404).json({ error: 'Resourse not found' });
});

app.use((error, req, res, next) => {
  res.status(500).json({ error: error.message });
});

app.listen(80, () => console.log('Listening on port 80'));
