const express = require('express');
app = express()
// const puppeteer = require("puppeteer");
// const {convert} = require("html-to-text");

const port = 3000;


app.get('/', async (req, res) => {
    // const browser = await puppeteer.launch({headless: true});
    // const page = await browser.newPage();
    //
    // await page.goto("https://sal.portal.bl.ch/sekow/index.php?login");
    //
    // await page.type("[name=isiwebuserid]", "e254989");
    // await page.type("[name=isiwebpasswd]", "flazu66.100%");
    //
    // await page.click("[type=submit]");
    //
    // await page.waitForSelector("img ", {
    //     visible: true
    // });
    //
    // await page.click("[id=menu21311]");
    //
    // await page.waitForSelector("img ", {
    //     visible: true
    // });
    //
    // let temp = await page.evaluate(() => {
    //     let data = [];
    //     let elements = document.getElementsByClassName('mdl-data-table mdl-js-data-table mdl-table--listtable');
    //     for (let element of elements)
    //         data.push(element.innerHTML);
    //     return data;
    // });
    //
    // let values = convert(temp[0], {wordwrap: 130});
    //
    // values = values.replace("Kurs Notendurchschnitt Bestätigt ", "");
    //
    // let marks = {}
    //
    //
    // function getSingleMarks(string){
    //     let details = []
    //     string = string.replace("Datum Thema Bewertung Gewichtung ", "").replace("\n", " ").replace(/\n/g,' ')
    //     string = string.substring(0, string.length - 30);
    //     let tests = [];
    //     let current = "";
    //     string.split(" ").forEach(value => {
    //         if(value.charAt(2) === value.charAt(5) && value.charAt(2) === ".")
    //         {
    //             if(current !== "")
    //             {
    //                 current = current.substring(0, current.length - 1);
    //                 if(current.includes("Details zur Note"))
    //                 {
    //                     let weight = current.charAt(current.length);
    //                     current = current.replace(" Details zur Note Punkte:", "").replace(current.split(" ")[current.split(" ").length - 2] + " " +
    //                         current.split(" ")[current.split(" ").length - 1], current.split(" ")[current.split(" ").length - 1]);
    //                     current += weight;
    //                 }
    //                 tests.push(current);
    //                 current = "";
    //             }
    //         }
    //         current += value + " ";
    //     });
    //     current = current.substring(0, current.length - 1);
    //     if(current.includes("Details zur Note"))
    //     {
    //         let weight = current.charAt(current.length);
    //         current = current.replace(" Details zur Note Punkte:", "").replace(current.split(" ")[current.split(" ").length - 2] + " " +
    //             current.split(" ")[current.split(" ").length - 1], current.split(" ")[current.split(" ").length - 1]);
    //         current += weight;
    //     }
    //     tests.push(current);
    //
    //     tests.forEach(info => {
    //         let infoNice = {}
    //         infoNice["datum"] = info.split(" ")[0];
    //         infoNice["note"] = info.split(" ")[info.split(" ").length - 2]
    //         infoNice["gewicht"] = info.split(" ")[info.split(" ").length - 1]
    //         infoNice["name"] = info.replace(infoNice.datum + " ", "").replace(" " + infoNice.note + " " + infoNice.gewicht);
    //         infoNice["name"] = infoNice.name.replace("undefined", "");
    //         details.push(infoNice);
    //     })
    //     return details;
    // }
    //
    // function getDetails(string){
    //     let details = {}
    //     details["schnitt"] = string.split("\n")[1].split(" ")[string.split("\n")[1].split(" ").length - 1];
    //     details["fach"] = string.split("\n")[1].replace(" " + details["schnitt"], "");
    //     details["bestatigt"] = (string.split("\n")[4] === "ja");
    //     return details;
    // }
    //
    // let active;
    //
    // values.split("\n\n").forEach(section => {
    //     if(!section.startsWith("Datum"))
    //     {
    //         const details = getDetails(section);
    //         marks[details["fach"]] = {"schnitt": details["schnitt"], "bestatigt": details["bestatigt"]};
    //         active = details["fach"];
    //     }
    //     else
    //     {
    //         marks[active]["noten"] = getSingleMarks(section);
    //     }
    // });
    //
    // await browser.close();
    res.send("marks");
})

app.listen(port, () => {
    console.log("Example app listening on port " + port);
});
