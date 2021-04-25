# Demonstration of using hostPath to live update an app in Kubernetes

## Problem Statement

Show live updating of code in k8s micro service based system running locally
in Docker Desktop for Mac.
Code live in a lerna monorepo, which means that there will be symlinks within
the node_modules folders.

# Building up an an example

## File watcher app

The folder `monitor` contains a very simple nodejs app, that uses
[chokidar](https://github.com/paulmillr/chokidar) to monitor a folder
and print messages to the console.

### Running locally

To run the app do the the following:

```
cd watcher
npm install
npm start
```

This should print out a message like:

```
> watcher@1.0.0 start
> node server.js

Starting to watch ./monitor
```

If, in another terminal, you create files in the monitor folder you
will see messages like:

```
add monitor/foo
```

### Running with Docker

Run the following command to build the Docker image with tag `local/watcher`

```
docker build . -t local/watcher
```

The following command will then run the container with input/output to
the current terminal (the `-it` flags). Pressing ctrl+C will kill the container and it
be removed (the `--rm` flag).

```
docker run -it --rm --name watcher local/watcher
```

Once the container is running, you can exec into into it like this:

```
docker exec -it watcher /bin/bash
```

And modifiy files in the monitor folder and see the watcher output.

```
touch monitor/foo.txt
```
