# time-streams

A super simple protocol for small scale, low volume, most-recent-first data feeds.

This is a partial implementation. Check out the [API draft](https://docs.google.com/document/d/1DN-omzUg8SiNb8jIhI8RJ5gwciasDLfRFKFD5h4MF-c/edit) if you like.

## Setup

    yarn install

## Example

Start the server:

    yarn dev

Then in another shell:

    curl -X POST -H "Authorization: Bearer devsekrit" -H "Content-Type: text/plain" --data "hi from curl" http://localhost:3333/posts

Now open http://localhost:3333/posts in your browser.
