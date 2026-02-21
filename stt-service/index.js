require("dotenv").config();

const express = require("express");
const sttRoutes = require("./routes");

const app = express();
const port = Number(process.env.PORT) || 5002;

app.use(express.json());
app.use("/api/stt", sttRoutes);

app.listen(port, () => {
	console.log(`STT service running on port ${port}`);
});
