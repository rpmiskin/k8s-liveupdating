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

### Building the image

Run the following command to build and tag the Docker image.

```
docker build . -t local/watcher
```

**Note** The later commands expect the image to have been tagged as
`local/watcher`.

### Running with Docker

The following command will then run the container with input/output to
the current terminal (the `-it` flags). Pressing ctrl+C will kill the
container and it will be automatically removed (the `--rm` flag).

```
docker run -it --rm --name watcher local/watcher
```

Once the container is running, you can exec into into it like this:

```
docker exec -it watcher /bin/bash
```

And modify files in the monitor folder and see the watcher output.

```
touch monitor/foo.txt
```

### Running in k8s

The file `basic-deployment.yml` will start a pod with using the `local/watcher` image. **Note** The pod is defined with an `ImagePullPolicy` of `Never` to ensure the locally built version is used.

The following command will deploy the pod and start following the logs:

```
kubectl apply -f basic-deployment.yml
kubectl logs -f monitor-pod
```

Now exec into the container with the follwing command:

```
kubectl exec -it monitor-pod -- /bin/bash
```

And modify files in the monitor folder to see watcher output.

```
touch monitor/foo.txt
```

To clean up, delete the pod by running:

```
kubectl delete pod monitor-pod
```
