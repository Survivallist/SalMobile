const express = require('express');
app = express()
const puppeteer = require("puppeteer");
const {convert} = require("html-to-text");

const port = 3000;

app.use(express.json());

app.post('/getMarks', async (req, res) => {
    const e = req.body.e;
    const password = req.body.password;
    const school = req.body.school;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    await page.goto("https://sal.portal.bl.ch/" + school + "/index.php?login");

    if(e !== undefined && e !== null && password !== undefined && password !== null)
    {
        await page.type("[name=isiwebuserid]", e);
        await page.type("[name=isiwebpasswd]", password);
    }
    else
    {
        res.send("failed")
        return;
    }

    await page.click("[type=submit]");

    await page.waitForSelector("img ", {
        visible: true
    });

    if (page.url() === "https://sal.portal.bl.ch/" + school + "/index.php?login")
    {
        res.send("failed")
        return;
    }

    await page.click("[id=menu21311]");

    await page.waitForSelector("img ", {
        visible: true
    });

    let temp = await page.evaluate(() => {
        let data = [];
        let elements = document.getElementsByClassName('mdl-data-table mdl-js-data-table mdl-table--listtable');
        for (let element of elements)
            data.push(element.innerHTML);
        return data;
    });

    let values = convert(temp[0], {wordwrap: 130});

    values = values.replace("Kurs Notendurchschnitt Bestätigt ", "");

    let marks = {}


    function getSingleMarks(string){
        let details = []
        string = string.replace("Datum Thema Bewertung Gewichtung ", "").replace("\n", " ").replace(/\n/g,' ')
        string = string.substring(0, string.length - 30);
        let tests = [];
        let current = "";
        string.split(" ").forEach(value => {
            if(value.charAt(2) === value.charAt(5) && value.charAt(2) === ".")
            {
                if(current !== "")
                {
                    current = current.substring(0, current.length - 1);
                    if(current.includes("Details zur Note"))
                    {
                        let weight = current.charAt(current.length);
                        current = current.replace(" Details zur Note Punkte:", "").replace(current.split(" ")[current.split(" ").length - 2] + " " +
                            current.split(" ")[current.split(" ").length - 1], current.split(" ")[current.split(" ").length - 1]);
                        current += weight;
                    }
                    tests.push(current);
                    current = "";
                }
            }
            current += value + " ";
        });
        current = current.substring(0, current.length - 1);
        if(current.includes("Details zur Note"))
        {
            let weight = current.charAt(current.length);
            current = current.replace(" Details zur Note Punkte:", "").replace(current.split(" ")[current.split(" ").length - 2] + " " +
                current.split(" ")[current.split(" ").length - 1], current.split(" ")[current.split(" ").length - 1]);
            current += weight;
        }
        tests.push(current);

        tests.forEach(info => {
            let infoNice = {}
            infoNice["datum"] = info.split(" ")[0];
            infoNice["note"] = info.split(" ")[info.split(" ").length - 2]
            infoNice["gewicht"] = info.split(" ")[info.split(" ").length - 1]
            infoNice["name"] = info.replace(infoNice.datum + " ", "").replace(" " + infoNice.note + " " + infoNice.gewicht);
            infoNice["name"] = infoNice.name.replace("undefined", "");
            details.push(infoNice);
        })
        return details;
    }

    function getDetails(string){
        let details = {}
        if(string.split("\n")[1] !== undefined)
        {
            details["schnitt"] = string.split("\n")[1].split(" ")[string.split("\n")[1].split(" ").length - 1];
            details["fach"] = string.split("\n")[1].replace(" " + details["schnitt"], "");
            details["bestatigt"] = (string.split("\n")[4] === "ja");
        }
        else
        {
            console.log(string);
        }
        return details;
    }

    let active;

    values.split("\n\n").forEach(section => {
        if(!section.startsWith("Datum"))
        {
            const details = getDetails(section);
            marks[details["fach"]] = {"schnitt": details["schnitt"], "bestatigt": details["bestatigt"]};
            active = details["fach"];
        }
        else
        {
            marks[active]["noten"] = getSingleMarks(section);
        }
    });

    await browser.close();

    res.send(marks);
})

app.post('/isUser', async (req, res) => {
    const e = req.body.e;
    const password = req.body.password;
    const school = req.body.school;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    await page.goto("https://sal.portal.bl.ch/" + school  + "/index.php?login");

    if(e !== undefined && e !== null && password !== undefined && password !== null)
    {
        await page.type("[name=isiwebuserid]", e);
        await page.type("[name=isiwebpasswd]", password);
    }
    else
    {
        res.send(false)
        return;
    }

    await page.click("[type=submit]");

    await page.waitForSelector("img ", {
        visible: true
    });

    let url = page.url()

    await browser.close();

    res.send(url  !== "https://sal.portal.bl.ch/" + school + "/index.php?login");
})

app.listen(port, () => {
    console.log("Example app listening on port " + port);
});
