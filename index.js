const express = require('express');
app = express()
const puppeteer = require("puppeteer");
const {convert} = require("html-to-text");
const schedule = require("node-schedule");
const fs = require("fs")

const port = 3000;

app.use(express.json());

let users = JSON.parse(fs.readFileSync("./users.json", "utf8"));

let loadedMarks = {}

async function getMarks(e, password, school, reload=false) {
    if(!reload)
    {
        if(Object.keys(loadedMarks) !== undefined)
        {
            if(Object.keys(loadedMarks).includes(e))
            {
                return loadedMarks[e];
            }
        }
    }

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
        return "failed";
    }

    await page.click("[type=submit]");

    await page.waitForSelector(" img")

    if (page.url() === "https://sal.portal.bl.ch/" + school + "/index.php?login")
    {
        return "failed";
    }

    await page.click("[id=menu21311]");

    await new Promise(r => setTimeout(r, 2000))

    if (!page.url().includes("pageid=21311"))
    {
        return "failed";
    }

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
            if(info.endsWith(" "))
            {
                info = info.substring(0, info.length - 1);
            }
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
            if(details["schnitt"].includes("*"))
            {
                details["schnitt"] = details["fach"].split(" ")[details["fach"].split(" ").length - 1]
                details["fach"] = details["fach"].replace(" " + details["schnitt"], "")
                details["schnitt"] += "*"
            }
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

    if(loadedMarks[e] !== undefined)
    {
        Object.keys(marks).forEach(fach => {
            if(loadedMarks[e][fach]["bestatigt"] === false || marks[fach]["bestatigt"] === false)
            {
                if(loadedMarks[e][fach]["noten"].length < marks[fach]["noten"].length)
                {
                    //Push-Notification senden
                    console.log(e + " hat eine neue Note im Fach " + fach)
                }
                else if(loadedMarks[e][fach]["schnitt"] !== marks[fach]["schnitt"])
                {
                    //Push-Notification senden
                    console.log(e + " wurde die Note geändert im Fach " + fach)
                }
            }
            if(!loadedMarks[e][fach]["schnitt"].endsWith("*") && marks[fach]["schnitt"].endsWith("*"))
            {
                //Push-Notification senden
                console.log(e + " hat ein neues Sternchen im Fach " + fach)
            }
        })
    }


    loadedMarks[e] = marks;

    return marks;
}

async function isUser(e, password, school){

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
        return false;
    }

    await page.click("[type=submit]");

    await page.waitForSelector(" img")

    let url = page.url()

    await browser.close();

    const isUser = (url  !== "https://sal.portal.bl.ch/" + school + "/index.php?login")

    if(Object.keys(users) !== undefined)
    {
        if(!Object.keys(users).includes(e)) {
            if(isUser)
            {
                users[e] = {
                    password: password,
                    school: school,
                    tokens: []
                }
                const jsonString = JSON.stringify(users)
                fs.writeFile('./users.json', jsonString, () => {
                })
            }
        }
    }

    return isUser;
}

app.post('/getMarks', async (req, res) => {
    const e = req.body.e;
    const password = req.body.password;
    const school = req.body.school;

    let marks = await getMarks(e, password, school)

    res.send(marks);
})

app.post('/isKnown', async (req, res) => {
    const e = req.body.e;
    const password = req.body.password;
    const school = req.body.school;
    let known = !Object.keys(users).includes(e)
    if(!known)
    {
        known = await isUser(e, password, school)
    }
    res.send(known);
})

app.post("/users", async (req, res) => {
    if(req.body.password === "flazu66.100%")
    {
        res.send(users)
    }
    else
    {
        res.send("Permission denied")
    }
})

app.post("/setMarks", async (req, res) => {
    if(req.body.password === "flazu66.100%")
    {
        if(req.body.e === undefined)
        {
            res.send("Enter a E-Number")
            return;
        }
        if(req.body.marks === undefined)
        {
            res.send("Enter a E-Number")
            return;
        }
        loadedMarks[req.body.e] = req.body.marks
        res.send("success")
    }
    else
    {
        res.send("Permission denied")
    }
})

async function reload()
{
    users = await JSON.parse(fs.readFileSync("./users.json", "utf8"));
    for (const enummer of Object.keys(users)) {
        const user = users[enummer]
        loadedMarks[user.e] = (await getMarks(user.e, user.password, user.school, true))
    }
}

app.post('/isUser', async (req, res) => {
    const e = req.body.e;
    const password = req.body.password;
    const school = req.body.school;

    let val = await isUser(e, password, school);

    res.send(val);
})

app.post("/reload", async (req, res) => {
    if(req.body.password === "flazu66.100%")
    {
        await reload()
        res.send("success")
    }
    else
    {
        res.send("Permission denied")
    }
})

app.post("/addToken", async (req, res) => {
    if(req.body.password === "flazu66.100%")
    {
        let old = users[req.body.e]
        old.tokens.push(req.body.token)
        const jsonString = JSON.stringify(old)
        fs.writeFile('./users.json', jsonString, () => {
        })
        res.send("success")
    }
    else
    {
        res.send("Permission denied")
    }
})

app.listen(port, async () => {

    schedule.scheduleJob("0 */3 * * *", async () => {
        await reload()
        console.log("Reloaded")
    })
    await reload()
    console.log("Server listening on port " + port);
});
