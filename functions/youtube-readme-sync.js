const axios = require('axios').default
const queryString = require('query-string')
const github = require('octonode')

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

const run = async () => {
    // Get the latest YouTube videos for your channel
    const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?${queryString.stringify(YT_SEARCH_PARAMS)}`,
    )
    const latestVideos = response.data.items

    const divider = `\n<img align="center" width="100%" height="0" />\n`

    // Generate the table
    const videoRows = latestVideos.map((video) => {
        const id = video.id.videoId
        const title = video.snippet.title.split('|')[0]

        // prettier-ignore
        return `[<img src="https://img.youtube.com/vi/${id}/maxresdefault.jpg" align="left" width="200" />](https://www.youtube.com/watch?v=${id}) **[${title}](https://www.youtube.com/watch?v=${id})**`
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
