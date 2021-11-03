const puppeteer = require('puppeteer')
const express = require('express')
const app = express()
const fs = require('fs')
const config = require('./config.json')
const cookies = require('./cookies.json')

;(async () => {
    app.set('view engine', 'ejs')
    console.log('Fetching posts from Facebook feed, please wait.')
    let rss
    let browser = await puppeteer.launch({ headless: true })
    let page = await browser.newPage()

    async function getPosts() {
        let postAuthorAndGroup = []
        let postContent = []
        let postLink = []
        let pAaG = []
        let pC = []
        let pL = []
        let pI = []
        console.log('-------------------------')
        for(let i = 0; i < 8; i++) {
            postAuthorAndGroup[i] = await page.$(`#u_0_${i} > div > header > table > tbody > tr`)
            postContent[i] = await page.$(`#u_0_${i} > div > div`)
            postLink[i] = await page.$(`#u_0_${i} > footer:nth-child(2) > div:nth-child(2) > a:nth-child(5)`)
            pAaG[i] = await page.evaluate(author => author.textContent, postAuthorAndGroup[i]).catch(() => {pAaG[i] = ''})
            pC[i] = await page.evaluate(content => content.textContent, postContent[i]).catch(() => {pC[i] = ''})
            pL[i] = await page.evaluate(link => link.href, postLink[i]).catch(() => {pC[i] = ''})
            pI[i] = await page.$$eval(`#u_0_${i} > div > div img[src]`, imgs => imgs.map(img => img.getAttribute('src')))
            console.log('Post loaded successfully.')
            rss += `
            <item>
                <title>${pAaG[i]}</title>
                <description>
                    <![CDATA[<img align="left" hspace="8" src="${pI[i]}"/><br />]]>
                    ${pC[i]}
                </description>
                <link>${pL[i]}</link>
            </item>`
        }
    }

    async function facebookSync() {
        if(Object.keys(cookies).length) {
            await page.setCookie(...cookies)
            await page.goto('https://mbasic.facebook.com/', { waitUntil: 'networkidle2' })

            await getPosts()
        } else {
            await page.goto('https://mbasic.facebook.com/', { waitUntil: 'networkidle2' })
            await page.type('#m_login_email', config.username)
            await page.type('#login_form > ul > li:nth-child(2) > section > input', config.password)
            await page.click('#login_form > ul > li:nth-child(3) > input')

            await getPosts()

            let currentCookies = await page.cookies()
            fs.writeFileSync('./cookies.json', JSON.stringify(currentCookies))
        }
    }

    await facebookSync()

    app.get('/', async (req, res) => {
        await facebookSync()
        res.set('Content-Type', 'application/rss+xml').end(`<?xml version="1.0" encoding="UTF-8" ?>
        <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss">
        <channel>
             <title>safebook</title>
             <description>Say Goodnight to the Bad Guys</description>
             ${rss.replace('undefined', '')}
        </channel>
        </rss>`)
    })

    app.get('/refresh', async () => {
        await facebookSync()
    })
})()

const listen = (port) => {
    app.listen(port, () => {
        console.log(`Listening at :${port}!`)
    })
}
return listen(8080)