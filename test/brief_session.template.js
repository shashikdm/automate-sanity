const moment = require('moment');
const http = require('https');
const webdriver = require('selenium-webdriver');
const { By } = require('selenium-webdriver');
const { assert } = require('console');

function equalsIgnoreCase(first, second) {
    if (first == second) { return true; }
    if (first === undefined || second === undefined) { return false; }
    if (first === null || second === null) { return false; }
    return first.toUpperCase() == second.toUpperCase();
};


const includeForAll = {
    "browserstack.networkLogs": false
}
const sessions = []

var sessionObj;

session_key = "<SESSION_NAME>";
session_cap = JSON.parse('<SESSION_CAP>');
hub_url = process.env.HUB_URL;
session_cap['build'] = `${session_cap['build']}  [${hub_url}]`
consoleLogCount = 10
xhrCount = 5

describe(`${session_key} Session`, function() {

    test(`Should run successfully`, async() => {
        let driver = new webdriver.Builder()
            .usingServer(`http://${process.env.BS_USERNAME}:${process.env.BS_ACCESS_KEY}@${hub_url}/wd/hub`)
            .withCapabilities(session_cap)
            .build();
        sessionObj = await driver.getSession();

        await driver.get(`https://dinsaw.github.io/testsite/short.html?consoleLogCount=${consoleLogCount}&xhrCount=${xhrCount}`);

        const randomQuoteDiv = await driver.wait(webdriver.until.elementLocated(By.id('randomQuotes')), 5000)

        const randomQuotesText = await randomQuoteDiv.getText();

        assert(randomQuotesText.includes('Random Quotes'));
        // Wait for sometime
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (session_cap['browserstack.local']) {
            await driver.get('http://localhost:45454');
            const title = await driver.getTitle();
            assert(title == "BrowserStack Local");
        }

        if (session_cap.shouldIdleTimeout) {
            return;
        }

        await driver.quit();

    }, 300000)

    let BREATH_TIME = 1000;

    if (equalsIgnoreCase("windows", session_cap["os"])) {
        BREATH_TIME = 6000;
    }

    test('Should wait before further tests to run', async() => {
        await new Promise(resolve => setTimeout(resolve, BREATH_TIME));
    }, (BREATH_TIME + 2000));


    if (session_cap.shouldIdleTimeout) {
        test('Should wait for Idle Timeout', async() => {
            await new Promise(resolve => setTimeout(resolve, 10000 + (1000 * session_cap['browserstack.idleTimeout'])));
        }, (1000 * session_cap['browserstack.idleTimeout']) + 20000);

        test(`Session should idle timeout in ${session_cap['browserstack.idleTimeout']}`, async() => {
            sessionJson = await new Promise(resolve => {
                    // console.log(`calling https://api.browserstack.com/automate/sessions/${sessionObj.getId()}.json`)
                    http.get(
                        `https://api.browserstack.com/automate/sessions/${sessionObj.getId()}.json`, {
                            headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
                        }, response => {
                            let data = '';
                            response.on('data', _data => (data += _data));
                            response.on('end', () => resolve(data));
                        })
                })
                // console.log(`sessionJson ${JSON.stringify(sessionJson)}`)
            sessionJson = JSON.parse(sessionJson);
            expect(sessionJson.automation_session.browserstack_status).toBe('timeout')
        }, 30000)
    }

    test(`Should have raw logs`, async() => {
        let raw_logs = await new Promise(resolve => {
            http.get(
                `https://api.browserstack.com/automate/sessions/${sessionObj.getId()}/logs`, {
                    headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
                }, response => {
                    let data = '';
                    response.on('data', _data => (data += _data));
                    response.on('end', () => resolve(data));
                })
        })
        expect(raw_logs.indexOf('REQUEST')).toBeGreaterThan(-1)
    }, 60000)

    if (session_cap["browserstack.networkLogs"] == true || session_cap["browserstack.networkLogs"] == "true") {
        if(equalsIgnoreCase("android", session_cap["browserName"])) {
            test('Should wait before running networkLogsTest', async() => {
                await new Promise(resolve => setTimeout(resolve, 40000));
            }, (40000 + 2000));
        }
        test(`Should have network logs`, async() => {
            let networkLogs = await new Promise(resolve => {
                http.get(
                    `https://api.browserstack.com/automate/sessions/${sessionObj.getId()}/networklogs`, {
                        headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
                    }, response => {
                        let data = '';
                        response.on('data', _data => (data += _data));
                        response.on('end', () => resolve(data));
                    })
            })
            networkLogs = JSON.parse(networkLogs)
            expect(networkLogs.log.entries.length).toBeGreaterThan(xhrCount)
        }, 60000)
    } else {
        test(`Should not have network logs`, async() => {
            let networkLogs = await new Promise(resolve => {
                http.get(
                    `https://api.browserstack.com/automate/sessions/${sessionObj.getId()}/networklogs`, {
                        headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
                    }, response => {
                        expect(response.statusCode).toBe(404);
                        let data = '';
                        response.on('data', _data => (data += _data));
                        response.on('end', () => resolve(data));
                    })
            })
            expect(() => { JSON.parse(networkLogs) }).toThrow();
        }, 60000)
    }

    if (session_cap["browserstack.console"] === "disable" ||
        equalsIgnoreCase("safari", session_cap["browserName"]) ||
        equalsIgnoreCase("iphone", session_cap["browserName"])) {
        test(`Should not have console logs`, async() => {
            let consoleLogs = await new Promise(resolve => {
                http.get(
                    `https://api.browserstack.com/automate/sessions/${sessionObj.getId()}/consolelogs`, {
                        headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
                    }, response => {
                        if (equalsIgnoreCase("windows", session_cap["os"])) {
                            expect(response.statusCode).toBe(404); // on mac we do not get 404
                        }
                        let data = '';
                        response.on('data', _data => (data += _data));
                        response.on('end', () => resolve(data));
                    })
            })
            if (equalsIgnoreCase('os x', session_cap["os"])) {
                expect(consoleLogs).toContain('No messages were logged in this Session');
            }
        }, 60000)
    } else {
        test(`Should have console logs`, async() => {
            let consoleLogs = await new Promise(resolve => {
                http.get(
                    `https://api.browserstack.com/automate/sessions/${sessionObj.getId()}/consolelogs`, {
                        headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
                    }, response => {
                        expect(response.statusCode).toBe(200);
                        let data = '';
                        response.on('data', _data => (data += _data));
                        response.on('end', () => resolve(data));
                    })
            })
            for (let index = 0; index < consoleLogCount; index++) {
                if (session_cap.browserName === "Firefox") {
                    expect(consoleLogs).toContain(`No messages were logged in this Session`);
                } else {
                    expect(consoleLogs).toContain(`Console Log ${index}`);
                }
            }
        }, 60000)
    }

    if (session_cap["browserstack.seleniumLogs"] == false || session_cap["browserstack.seleniumLogs"] == "false") {
        test(`Should not have selenium Logs. Skipping`, async() => {
            // await new Promise(resolve => {
            //     http.get(
            //         `https://api.browserstack.com/automate/sessions/${sessionObj.getId()}/seleniumlogs`, {
            //             headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
            //         }, response => {
            //             let data = '';
            //             response.on('data', _data => (data += _data));
            //             response.on('end', () => resolve(response.statusCode, data));
            //         })
            // }).then(arr => {
            //     expect(arr[0]).toBe(404);
            // });
        }, 60000)
    } else {
        test(`Should have seleniumLogs`, async() => {
            let seleniumLogs = await new Promise(resolve => {
                http.get(
                    `https://api.browserstack.com/automate/sessions/${sessionObj.getId()}/seleniumlogs`, {
                        headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
                    }, response => {
                        let data = '';
                        response.on('data', _data => (data += _data));
                        response.on('end', () => resolve(data));
                    })
            })
            expect(seleniumLogs.length).toBeGreaterThan(0)
        }, 30000)
    }
});
