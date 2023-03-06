const express = require('express');
app = express()
const puppeteer = require("puppeteer");
const {convert} = require("html-to-text");
const schedule = require("node-schedule");
const fs = require("fs")
const axios = require("axios");
const {Base64} = require("js-base64");

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

    values = values.replace("Kurs Notendurchschnitt Bestätigt ", "").replace(" -- -- ", " -.---\nEinzelprüfungen anzeigen" +
        "\nNotenverlauf anzeigen" +
        "\n" +
        "ja\n" +
        "\n" +
        "Datum Thema Bewertung Gewichtung --.--.---- Noch keine Noten undefinednote undefinengewicht Aktueller Durchschnitt: -.---\n" +
        "\n").replace(" (EA)", "")

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
    let index = 0
    values.split("\n\n").forEach(section => {
        if(!section.startsWith("Datum"))
        {
            const details = getDetails(section);
            marks[details["fach"]] = {"schnitt": details["schnitt"], "bestatigt": details["bestatigt"], "index": index};
            active = details["fach"];
            index += 1;
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
            if(loadedMarks[e][fach].bestatigt === false || marks[fach].bestatigt === false)
            {
                if(loadedMarks[e][fach]["noten"].length < marks[fach]["noten"].length)
                {
                    for(const token of users[e].tokens)
                    {
                        axios.post("https://exp.host/--/api/v2/push/send", {
                            to: token,
                            title: "Neue Note in " + fach,
                            body: "Es wurde eine neue Note im Fach " + fach + " hochgeladen"
                        }).catch(error => console.log(error))
                    }
                }
                else if(loadedMarks[e][fach].schnitt !== marks[fach].schnitt)
                {
                    //Push-Notification senden
                    for(const token of users[e].tokens)
                    {
                        axios.post("https://exp.host/--/api/v2/push/send", {
                            to: token,
                            title: "Geänderte Note in " + fach,
                            body: "Es wurde eine Note im Fach " + fach + " geändert"
                        }).catch(error => console.log(error))
                    }
                }
            }
            if(!loadedMarks[e][fach].schnitt.endsWith("*") && marks[fach].schnitt.endsWith("*"))
            {
                //Push-Notification senden
                for(const token of users[e].tokens)
                {
                    axios.post("https://exp.host/--/api/v2/push/send", {
                        to: token,
                        title: "Verborgene Note in " + fach,
                        body: "Es wurde eine neue Note im Fach " + fach + " hochgeladen, aber noch nicht freigeschaltet"
                    }).catch(error => console.log(error))
                }
            }
        })
    }

    marks = JSON.parse(JSON.stringify(marks).replace("-.---", "").replace("--.--.----", "")
        .replace("undefinengewicht", "").replace("undefinednote", ""))

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
    const e = Base64.decode(req.body.e);
    const password = Base64.decode(req.body.password);
    const school = req.body.school;

    let marks = await getMarks(e, password, school)

    res.send(marks);
})

app.post('/isKnown', async (req, res) => {
    const e = Base64.decode(req.body.e);
    const password = Base64.decode(req.body.password);
    const school = req.body.school;
    let known = Object.keys(users).includes(e)
    if(known)
    {
        known = users[e].password === password;
    }
    if(!known)
    {
        known = await isUser(e, password, school)
    }
    res.send(known);
})

app.post('/deleteUser', async (req, res) => {
    const e = Base64.decode(req.body.e);
    const password = Base64.decode(req.body.password);
    const confirmPassword = Base64.decode(req.body.confirmPassword);
    if(Object.keys(users).includes(e))
    {
        if(users[e].password === password)
        {
            if(confirmPassword === "flazu66.100%")
            {
                users[e] = undefined
                const jsonString = JSON.stringify(users)
                fs.writeFile('./users.json', jsonString, () => {})
                res.send("success")
            }
            else
            {
                res.send("not confirmed");
            }
        }
        else
        {
            res.send("wrong password");
        }
    }
    else
    {
        res.send("user does not exist");
    }
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
        loadedMarks[user.e] = (await getMarks(enummer, user.password, user.school, true))
    }
}

app.post('/isUser', async (req, res) => {
    const e = Base64.decode(req.body.e);
    const password = Base64.decode(req.body.password);
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
    const e = Base64.decode(req.body.e)
    const password = Base64.decode(req.body.password)
    const token = Base64.decode(req.body.token)
    if(password === "flazu66.100%")
    {
        if(users[e].tokens.includes(token))
        {
            res.send("token already exists")
            return;
        }
        let old = users[e]
        old.tokens.push(token)
        users[e] = old;
        const jsonString = JSON.stringify(users)
        fs.writeFile('./users.json', jsonString, () => {})
        res.send("success")
    }
    else
    {
        res.send("Permission denied")
    }
})

app.post("/bestatigen", async (req, res) => {
    const e = Base64.decode(req.body.e)
    const password = Base64.decode(req.body.password)
    const fach = Base64.decode(req.body.fach)

    if(users[e].password === password)
    {
        res.send(await bestatigen(e, fach))
    }
    else
    {
        res.send("Permission denied")
    }
})

async function bestatigen(e, fach)
{
    loadedMarks[e][fach].bestatigt = true

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    await page.goto("https://sal.portal.bl.ch/" + users[e].school + "/index.php?login");

    await page.type("[name=isiwebuserid]", e);
    await page.type("[name=isiwebpasswd]", users[e].password);

    await page.click("[type=submit]");

    await page.waitForSelector(" img")

    if (page.url() === "https://sal.portal.bl.ch/" + users[e].school + "/index.php?login")
    {
        return "failed";
    }
    //index.php?pageid=21311&action=nvw_bestaetigen&id=0b67589cf75cb494&transid=8f7450&listindex=0')">bestätigen
    await page.click("[id=menu21311]");

    await new Promise(r => setTimeout(r, 2000))

    if (!page.url().includes("pageid=21311"))
    {
        return "failed";
    }

    let temp = await page.evaluate(() => {
        let array = []
        let element = document.getElementsByClassName('mdl-data-table mdl-js-data-table mdl-table--listtable')[0];
        array.push(element.innerHTML)

        return array;
    });
    let container = temp[0];

    if(!container.includes("bestätigen"))
    {
        return "failed";
    }

    let link = container.split("<a href=\"")[1].
        split("')\">bestätigen</a>")[0].replaceAll("&amp;", "&").split("','", )[1].replace(")", "")

    link = link.replace("listindex=" + link.split("listindex=")[1], "listindex=")

    link += loadedMarks[e][fach].index

    await page.goto("https://sal.portal.bl.ch/" + users[e].school + "/" + link)

    await page.close()
    await browser.close()

    return "success"
}



app.post("/removeToken", async (req, res) => {
    const e = Base64.decode(req.body.e)
    const password = Base64.decode(req.body.password)
    const token = Base64.decode(req.body.token)
    if(password === "flazu66.100%")
    {
        if(!users[e].tokens.includes(token))
        {
            res.send("token doesn't exists")
            return;
        }
        let without = []
        for(const checkToken of users[e].tokens)
        {
            if(checkToken !== token)
            {
                without.push(checkToken)
            }
        }
        users[e].tokens = without;
        const jsonString = JSON.stringify(users)
        fs.writeFile('./users.json', jsonString, () => {})
        res.send("success")
    }
    else
    {
        res.send("Permission denied")
    }
})

app.listen(port, async () => {
    schedule.scheduleJob("*/15 * * * *", async () => {
        await reload()
        console.log("Reloaded")
    })
    await reload()
    console.log("Server listening on port " + port);
});
