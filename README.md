# time-streams

A super simple protocol for small scale, low volume, most-recent-first data feeds.

This is a partial implementation. Check out the [API draft](https://docs.google.com/document/d/1DN-omzUg8SiNb8jIhI8RJ5gwciasDLfRFKFD5h4MF-c/edit) if you like.

## Setup

    yarn install

## Example

Try this out:

    mkdir -p public/K5BXQ5F5PFSNGJ09.timestream
    yarn dev

Then in another shell:

    curl -X POST -H "Content-Type: text/plain" --data "hi from curl" http://localhost:3333/streams/K5BXQ5F5PFSNGJ09

Now open http://localhost:3333/streams/K5BXQ5F5PFSNGJ09 in your browser.
