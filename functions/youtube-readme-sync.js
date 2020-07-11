const axios = require("axios").default
const queryString = require("query-string")
const github = require("octonode")

const ghClient = github.client({
    username: process.env.GITHUB_USERNAME,
    password: process.env.GITHUB_ACCESS_TOKEN,
})

const ghRepo = ghClient.repo(process.env.GITHUB_REPO)

const YT_SEARCH_PARAMS = {
    part: "snippet",
    channelId: process.env.YOUTUBE_CHANNEL_ID,
    maxResults: 3,
    order: "date",
    type: "video",
    key: process.env.GOOGLE_API_KEY,
}

const START_COMMENT = "<!-- YT TABLE START -->"
const END_COMMENT = "<!-- YT TABLE END -->"

const run = async () => {
    // Get the latest YouTube videos for your channel
    const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?${queryString.stringify(
            YT_SEARCH_PARAMS
        )}`
    )
    const latestVideos = response.data.items

    // Generate the table
    const imageRow = latestVideos.map((video) => {
        return `<a href="https://www.youtube.com/watch?v=${video.id.videoId}"><img src="https://img.youtube.com/vi/${video.id.videoId}/maxresdefault.jpg" width="200" style="border-radius:20px;" /></a>`
    })

    const dividerRow = latestVideos.map(() => "---")

    const titleRow = latestVideos.map((video) => {
        return `**[${
            video.snippet.title.split("|")[0]
        }](https://www.youtube.com/watch?v=${video.id.videoId})**`
    })

    const rows = [imageRow, dividerRow, titleRow].map(
        (row) => `| ${row.join(" | ")} |`
    )
    const table = `${START_COMMENT}\n${rows.join("\n")}\n${END_COMMENT}`

    // Get the current README.md
    const [readme] = await ghRepo.readmeAsync()
    const readmeContent = Buffer.from(readme.content, "base64").toString(
        "utf-8"
    )

    // Replace the existing videos table with the new one
    const newReadmeContent =
        readmeContent.split(START_COMMENT)[0] +
        table +
        readmeContent.split(END_COMMENT)[1]

    // Update the README.md
    await ghRepo.updateContentsAsync(
        readme.path,
        "Update videos table",
        newReadmeContent,
        readme.sha
    )
}

// The Netlify Functions handler function
exports.handler = async function () {
    try {
        await run()
    } catch (error) {
        console.error(error)

        return {
            statusCode: 500,
            body: "Internal Server Error",
        }
    }

    return {
        statusCode: 200,
        body: "OK",
    }
}

if (process.env.LOCAL_TEST) {
    run().catch((err) => {
        console.log(err)
    })
}
