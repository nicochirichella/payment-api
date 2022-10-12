const cors = require('cors');

const whitelist = /trocafone.(local|com|com\.ar|net)$/;

module.exports = cors({
  origin: whitelist,
  optionsSuccessStatus: 200,
});
