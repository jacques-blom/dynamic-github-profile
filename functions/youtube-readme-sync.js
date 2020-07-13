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

const overlay = Buffer.from(`
<svg>
    <rect fill-opacity="0.49" fill="#00152C" x="0" y="0" width="300" height="169"></rect>
    <rect fill="#FFFFFF" x="140" y="71" width="22" height="27"></rect>
    <path d="M149.477998,59 C149.477998,59 127.28759,59 121.718093,60.4563442 C118.735992,61.2948195 116.280463,63.7658426 115.447228,66.8108627 C114,72.4154459 114,84.022077 114,84.022077 C114,84.022077 114,95.6727688 115.447228,101.189139 C116.280463,104.234117 118.692136,106.66101 121.718093,107.499506 C127.331445,109 149.477998,109 149.477998,109 C149.477998,109 171.712398,109 177.28178,107.543658 C180.307758,106.70518 182.719382,104.322408 183.508767,101.233291 C185,95.6727829 185,84.0662295 185,84.0662295 C185,84.0662295 185.043692,72.4154459 183.508767,66.8108627 C182.719382,63.7658426 180.307758,61.3390077 177.28178,60.5446493 C171.712398,59 149.477998,59 149.477998,59 Z M143,74 L162,84.0206292 L143,94 L143,74 L143,74 Z" fill="#FF0000" fill-rule="nonzero"></path>
</svg>
`)

const roundedCorners = Buffer.from('<svg><rect x="0" y="0" width="300" height="169" rx="20" ry="20"/></svg>')

const generateThumbnail = async (video) => {
    const imageResponse = await axios.get(`https://img.youtube.com/vi/${video.id.videoId}/maxresdefault.jpg`, {
        responseType: 'arraybuffer',
    })

    return sharp(imageResponse.data)
        .resize(300, 169, {fit: 'fill'})
        .blur(4)
        .composite([
            {
                input: overlay,
            },
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
    const thumbnailCommitHashes = []
    for (let index = 0; index < latestVideos.length; index++) {
        const path = `assets/${index}.png`
        const existingFile = assetsDir.find((asset) => asset.path === path)
        const imageBuffer = thumbnails[index]

        let response
        if (existingFile) {
            response = await ghRepo.updateContentsAsync(path, 'Add thumbnail', imageBuffer, existingFile.sha)
        } else {
            response = await ghRepo.createContentsAsync(path, 'Add thumbnail', imageBuffer)
        }

        thumbnailCommitHashes.push(response[0].commit.sha)
    }

    // Generate the table
    const videoRows = latestVideos.map((video, index) => {
        const id = video.id.videoId
        const title = video.snippet.title.split('|')[0]
        const date = dateFormat(new Date(video.snippet.publishedAt), 'dd mmm yyyy')
        // Reference a specific commit to avoid caching issues and needing to specify the name of your base branch
        const commit = thumbnailCommitHashes[index]
        const thumbnail = `https://raw.githubusercontent.com/${process.env.GITHUB_REPO}/${commit}/assets/${index}.png`

        return `[<img src="${thumbnail}" align="left" width="200" />](https://www.youtube.com/watch?v=${id})
        **[${title}](https://www.youtube.com/watch?v=${id})**
        <br /> *${date}*`
    })

    const newList = `${START_COMMENT}\n${videoRows.join(divider)}${divider}${END_COMMENT}`

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
