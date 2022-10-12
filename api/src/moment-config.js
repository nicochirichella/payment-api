const moment = require('moment-business-time');

moment.updateLocale('en', {
  workinghours: {
    0: null,
    1: ['00:00:00', '23:59:59'],
    2: ['00:00:00', '23:59:59'],
    3: ['00:00:00', '23:59:59'],
    4: ['00:00:00', '23:59:59'],
    5: ['00:00:00', '23:59:59'],
    6: null,
  },
});
