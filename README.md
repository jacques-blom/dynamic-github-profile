# 📺 YouTube -> GitHub Readme Sync

<img alt="Example screenshot, showing YouTube videos listed on my GitHub profile" src="https://raw.githubusercontent.com/jacques-blom/dynamic-github-profile/main/screenshot.jpg" width="1174" />

A [Netlify function](https://www.netlify.com/products/functions/) that updates your GitHub profile repo with your latest YouTube videos. This can be adapted to other types of content, like blog posts, as well.

I created this to make my GitHub profile a bit more dynamic and interesting, and also used it as an opportunity to learn more about Netlify Functions.

## Setup tutorial video

Check out the video for a run-through of the code, and setup instructions:

<a href="https://youtu.be/9JVE8OGRSlA"><img alt="Click here for the tutorial video" src="https://raw.githubusercontent.com/jacques-blom/dynamic-github-profile/main/video.png" width="300" /></a>

## Written instructions

1. Fork this repository

2. If you haven't yet, create a new repo and name it the same as your username

3. Create a README.md to that repo, and add the following wherever you want the videos to be displayed

```md
<!-- YT LIST START -->
<!-- YT LIST END -->
```

4. Deploy the forked repo to Netlify (full walkthrough in [the video](https://youtu.be/9JVE8OGRSlA))

5. Set the following environment variables in your Netlify project settings (more info on how to create these in [the video](https://youtu.be/9JVE8OGRSlA))

```
GITHUB_REPO=your-username/your-username
GITHUB_USERNAME=your-bot-username
GITHUB_ACCESS_TOKEN=your-bot-personal-access-token

YOUTUBE_CHANNEL_ID=your-youtube-channel-id
GOOGLE_API_KEY=your-google-api-key
```

6. Call the function using something like Postman, to verify it's working

7. Set up a [YouTube webhook](https://developers.google.com/youtube/v3/guides/push_notifications) using Google's PubSubHubbub service

8. Et voilà! ✨
