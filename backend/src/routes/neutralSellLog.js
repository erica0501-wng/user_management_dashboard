const express = require('express');
const router = express.Router();

// ...existing code...

router.use(require('../../api/neutralSellLog'));

module.exports = router;
