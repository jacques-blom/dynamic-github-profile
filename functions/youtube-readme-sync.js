const axios = require('axios').default
const queryString = require('query-string')
const github = require('octonode')
const dateFormat = require('dateformat')
const sharp = require('sharp')

const ghClient = github.client({
    username: process.env.GITHUB_USERNAME,
    password: process.env.GITHUB_ACCESS_TOKEN,
})

const ghRepo = ghClient.repo(process.env.GITHUB_REPO)

const YT_SEARCH_PARAMS = {
    part: 'snippet',
    channelId: process.env.YOUTUBE_CHANNEL_ID,
    maxResults: 3,
    order: 'date',
    type: 'video',
    key: process.env.GOOGLE_API_KEY,
}

const START_COMMENT = '<!-- YT LIST START -->'
const END_COMMENT = '<!-- YT LIST END -->'

const roundedCorners = Buffer.from('<svg><rect x="0" y="0" width="300" height="169" rx="20" ry="20"/></svg>')

const generateThumbnail = async (id, index) => {
    const imageResponse = await axios.get(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`, {
        responseType: 'arraybuffer',
    })

    return sharp(imageResponse.data)
        .resize(300, 169, {fit: 'fill'})
        .composite([
            {
                input: roundedCorners,
                blend: 'dest-in',
            },
        ])
        .png()
        .toBuffer()
}

const run = async () => {
    // Get the latest YouTube videos for your channel
    const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?${queryString.stringify(YT_SEARCH_PARAMS)}`,
    )
    const latestVideos = response.data.items

    const divider = `\n<img align="center" width="100%" height="0" />\n`

    // Generate thumbnail images
    const thumbnails = await Promise.all(latestVideos.map((video, index) => generateThumbnail(video.id.videoId, index)))

    let assetsDir = null
    try {
        assetsDir = await ghRepo.contentsAsync('assets')
        assetsDir = assetsDir[0]
    } catch (error) {
        assetsDir = []
    }

    for (let i = 0; i < latestVideos.length; i++) {
        const existingFileAtPath = assetsDir.find((asset) => asset.name === `${i}.png`)
        console.log(existingFileAtPath)
        if (existingFileAtPath) {
            await ghRepo.updateContentsAsync(`assets/${i}.png`, 'Add thumbnail', thumbnails[i], existingFileAtPath.sha)
        } else {
            await ghRepo.createContentsAsync(`assets/${i}.png`, 'Add thumbnail', thumbnails[i])
        }
    }

    // Generate the table
    const videoRows = latestVideos.map((video, index) => {
        const id = video.id.videoId
        const title = video.snippet.title.split('|')[0]
        const date = dateFormat(new Date(video.snippet.publishedAt), 'dd mmm yyyy')

        return `[<img src="assets/${index}.png" align="left" width="200" />](https://www.youtube.com/watch?v=${id})
        **[${title}](https://www.youtube.com/watch?v=${id})**
        <br /> *${date}*`
    })

    const newList = `${START_COMMENT}\n${videoRows.join(divider)}\n${END_COMMENT}`

    // Get the current README.md
    const [readme] = await ghRepo.readmeAsync()
    const readmeContent = Buffer.from(readme.content, 'base64').toString('utf-8')

    // Replace the existing videos table with the new one
    const newReadmeContent = readmeContent.split(START_COMMENT)[0] + newList + readmeContent.split(END_COMMENT)[1]

    // Update the README.md
    await ghRepo.updateContentsAsync(readme.path, 'Update videos table', newReadmeContent, readme.sha)
}

// The Netlify Functions handler function
exports.handler = async function () {
    try {
        await run()
    } catch (error) {
        console.error(error)

        return {
            statusCode: 500,
            body: 'Internal Server Error',
        }
    }

    return {
        statusCode: 200,
        body: 'OK',
    }
}

if (process.env.LOCAL_TEST) {
    run().catch((err) => {
        console.log(err)
    })
}
