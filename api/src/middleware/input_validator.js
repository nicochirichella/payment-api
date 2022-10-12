module.exports = function inputValidator(setup) {
  return (req, res, next) => {
    setup(req);
    const errors = req.validationErrors();
    if (errors) {
      res.status(400).json({ errors });
    } else {
      next();
    }
  };
};
