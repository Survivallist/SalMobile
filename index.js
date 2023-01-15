const express = require('express');
app = express()
const puppeteer = require("puppeteer");
const {convert} = require("html-to-text");

const port = 3000;


app.get('/', async (req, res) => {
    res.send("marks");
})

app.listen(port, () => {
    console.log("Example app listening on port " + port);
});
