const router = require('express').Router();

router.get('/health', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(200).send();
});

module.exports = router;
