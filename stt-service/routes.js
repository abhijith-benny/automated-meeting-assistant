const express = require("express");
const { transcribeMeetingController } = require("./stt.controller");

const router = express.Router();

router.post("/transcribe", transcribeMeetingController);

module.exports = router;
