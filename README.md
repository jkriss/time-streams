# time-streams

A super simple protocol for small scale, low volume, most-recent-first data feeds.

This is a partial implementation. Check out the [API draft](https://docs.google.com/document/d/1DN-omzUg8SiNb8jIhI8RJ5gwciasDLfRFKFD5h4MF-c/edit) if you like.

## Setup

    yarn install

## Example

Try this out:

    yarn dev

Then in another shell:

    curl -X POST -H "Authorization: Bearer 01EB834HQFB14K81NR01DXPXZP" -H "Content-Type: text/plain" --data "hi from curl" http://localhost:3333/streams/K5BXQ5F5PFSNGJ09

Now open http://localhost:3333/streams/K5BXQ5F5PFSNGJ09 in your browser.

To post to another stream, try: 01EBAEG102H1ZPZPQP8SCX49CP

    curl -X POST -H "Authorization: Bearer 01EBAEG102H1ZPZPQP8SCX49CP" -H "Content-Type: text/plain" --data "hi on another stream" http://localhost:3333/streams/915DG1959Q4G62WM


## Remote storage

You can run this with any S3-compatible cloud storage, as well. Create a `.env` file like this:

    AWS_ACCESS_KEY_ID=your-key
    AWS_SECRET_ACCESS_KEY=your-secret-key
    S3_ENDPOINT=optional-endpoint
    BUCKET_NAME=your-bucket # default is timestreams

Note: the listFiles operation is not currently cached

If these environment variables are present, but you still want to force local file storage, use:

    LOCAL_STORE=true
