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

const generateThumbnail = async (video) => {
    const imageResponse = await axios.get(`https://img.youtube.com/vi/${video.id.videoId}/maxresdefault.jpg`, {
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

const getAssetsDir = async () => {
    try {
        const assetsDir = await ghRepo.contentsAsync('assets')
        return assetsDir[0]
    } catch (error) {
        return []
    }
}

const run = async () => {
    // Get the latest YouTube videos for your channel
    const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?${queryString.stringify(YT_SEARCH_PARAMS)}`,
    )
    const latestVideos = response.data.items

    const divider = `\n<img align="center" width="100%" height="0" />\n`

    // Generate thumbnail images
    const thumbnails = await Promise.all(latestVideos.map(generateThumbnail))

    // Upload the thumbnail images
    const assetsDir = await getAssetsDir()
    for (let index = 0; index++; index < latestVideos.length) {
        const path = `assets/${index}.png`
        const existingFile = assetsDir.find((asset) => asset.path === path)
        const imageBuffer = thumbnails[index]

        if (existingFile) {
            await ghRepo.updateContentsAsync(path, 'Add thumbnail', imageBuffer, existingFile.sha)
        } else {
            await ghRepo.createContentsAsync(path, 'Add thumbnail', imageBuffer)
        }
    }

    // Generate the table
    const videoRows = latestVideos.map((video, index) => {
        const id = video.id.videoId
        const title = video.snippet.title.split('|')[0]
        const date = dateFormat(new Date(video.snippet.publishedAt), 'dd mmm yyyy')
        const thumbnail = `https://raw.githubusercontent.com/${process.env.GITHUB_REPO}/master/assets/${index}.png`

        return `[<img src="${thumbnail}" align="left" width="200" />](https://www.youtube.com/watch?v=${id})
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
