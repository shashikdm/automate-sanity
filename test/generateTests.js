const fs = require('fs')
const moment = require('moment');
const { env } = require('process');
const http = require('https');
const os = require('os');
const browserstack = require('browserstack-local');

const bsLocal = new browserstack.Local();

const bsLocalArgs = { key: process.env.BS_ACCESS_KEY, force: true };

bsLocal.start(bsLocalArgs, () => {
    console.log('Started Local');
});

const fetchBrowsers = async() => {
    let data = await new Promise((resolve) => {
        http.get(
            `https://api.browserstack.com/automate/browsers.json`, {
                headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.BS_USERNAME + ':' + process.env.BS_ACCESS_KEY).toString('base64') }
            }, response => {
                let data = '';
                response.on('data', _data => (data += _data));
                response.on('end', () => resolve(data));
            })
    });
    console.log(`data = ${data}`);
    return JSON.parse(data);
}

if (env.TESTCASES === 'FROM_API_LATEST') {
    (async() => {
        let browsers = await fetchBrowsers();

        console.log(`browsers = ${JSON.stringify(browsers)}`)

        let latestBrowsers = new Map();
        browsers.filter(cap => cap.browser !== 'opera')
            .forEach(cap => {
                let browserKey = `${cap.os}_${cap.os_version}_${cap.browser}`
                console.log(`browserKey = ${browserKey}`)
                let storedBrowser = latestBrowsers.get(browserKey);
                console.log(`storedBrowser = ${storedBrowser}`)
                if (storedBrowser === undefined) { latestBrowsers.set(browserKey, cap); return; }
                if (storedBrowser.browser_version < cap.browser_version) {
                    latestBrowsers.set(browserKey, cap);
                }
            });

        const BUILD_NAME = `[Sanity-Random] [${moment().format('YYYY-MM-DD, h:mm:ss a')}] [FROM-${os.hostname()}]`;

        console.log(`Using Latest browser caps from API`)
        let code = fs.readFileSync(`${__dirname}/brief_session.template.js`, { encoding: 'utf8', flag: 'r' })

        randomKeys = [...latestBrowsers.keys()].sort(() => Math.random() - Math.random()).slice(0, 20)
        randomKeys.forEach((key) => {
            console.log(`latestBrowsers[key]  ${key}`)
            const cap = latestBrowsers.get(key);
            cap['build'] = BUILD_NAME;
            cap['name'] = key;
            cap['browserName'] = cap['browser']
            fs.writeFileSync(`${__dirname}/generated/${key}.test.js`,
                code.replace('<SESSION_NAME>', key).replace('<SESSION_CAP>', JSON.stringify(cap)))

        });


    })();
} else {
    const testSessionCaps = './brief_session_caps.json';

    console.log(`Using custom test cases from ${testSessionCaps}`)
    let code = fs.readFileSync(`${__dirname}/brief_session.template.js`, { encoding: 'utf8', flag: 'r' })

    const caps = require(testSessionCaps);

    const BUILD_NAME = `[Sanity-TestCase] [${moment().format('YYYY-MM-DD, h:mm:ss a')}] [FROM-${os.hostname()}]`;

    for (var key in caps) {
        caps[key]['build'] = BUILD_NAME;
        caps[key]['name'] = key;
        fs.writeFileSync(`${__dirname}/generated/${key}.test.js`,
            code.replace('<SESSION_NAME>', key).replace('<SESSION_CAP>', JSON.stringify(caps[key])))
    }

    console.log("GenerateTests Completed");
}