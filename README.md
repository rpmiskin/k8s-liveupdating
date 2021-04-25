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

## Building the image

Run the following command to build and tag the Docker image.

```
docker build . -t local/watcher
```

**Note** The later commands expect the image to have been tagged as
`local/watcher`.

## Running with Docker

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

## Running in k8s

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

### Clean up

To clean up, delete the pod by running:

```
kubectl delete pod monitor-pod
```

## Deploying with a locally mounted volume

So far we've shown that the `watcher` app works inside a container, but that doesn't really help the
development workflow problem if live updating code. It would be _much_ more useful if the `watcher`
app was looking at a local filesystem. This can be done my mounting a Persistent Volume with `hostPath`
and then linking it the the pod via an associated Persistent Volume Claim. The file
`mounted-deployment.yml` will set up exactly this configuration, although as the path to the
Persistent Volume must be absolute some `sed` is needed to modify the file.

Deploy using the following command

```
sed "s|CHANGE ME|$PWD/watcher/monitor|" mounted-deployment.yml | kubectl apply -f -
```

Now in one terminal start following the logs

```
kubectl logs -f monitor-pod
```

If you modify files in the `watcher/monitor` folder on your host you
should see files messages appear in the logs. This demonstrates that
events are fired inside the running container for changes on the host.

### Clean up

To clean up, remove the pod, claim and volume by running

```
kubectl delete pod monitor-pod
kubectl delete pvc monitor-claim
kubectl delete pv monitor-volume
```

## Updating a running deployment to use a mount

Ideally we would deploy our 'normal' environment in an production representive
manner (e.g. using `basic-deployment.yml`) and then add on the volume mapped to
the host.

The Peristent Volume and Persistent Volume Claim can be deployed separately
to the pod. The file `local-volume.yml` can do this if applied with

```
sed "s|CHANGE ME|$PWD/watcher/monitor|" local-volume.yml | kubectl apply -f -
```

And we could then replace the pod deployed with `basic-deployment.yml` with one 
that uses the existing volume as defined in `mount-existing.yml`.

```
kubectl replace pod -f mount-existing.yml
```

But this does a complete replace and if the settings don't match between the 
original deployment and mount-existing.yml testing may not be representative.

However, while there are some updates that can be made to a api resources while they
are running using `kubectl patch`, unfortunately you are forbidden from
adding a volume to an existing Pod. This means that the Pod will have to
be destroyed and recreated, with the volume attached.

This doesn't seem ideal for a development environment, where you may have
scripts (or Helm charts) to deploy a representative environment and you
just wish to update certain Pods for live updating.

You can obtain a description of a running pod that is suitable for using with
`kubectl apply` by running

```
kubectl get pod monitor-pod -o yaml
```

This can be piped directly into `kubectl replace` using like so:

```
kubectl get pod monitor-pod -o yaml | kubectl replace -f -
```

You could imagine a stage in between those two that updated the pod definition
with the attached volume...

The investigation continues!

## Possible Minikube complexity...

**Note** I have done no testing with Minikube - caveat emptor!

All of the examples in this repository have been run in Docker Desktop for Mac.
There may be further complexities if running in (for example) Minikube because
Docker Desktop does some sharing from the macos host to the VM running k8s
automatically.

It appears that Minikube needs to be started with the `--mount-string` option
to enable this - see this
[Stack Overflow](https://stackoverflow.com/questions/48534980/mount-local-directory-into-pod-in-minikube) answer.

For simplicities sake it might be wise make the mounted path identical to the
host path using something like:

```
minikube start --mount-string="$HOME:$HOME"
```

(Or possibly a subfolder of $HOME where your code is to avoid any risks around sharing the root
of your home directory...)
