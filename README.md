# Demonstration of using hostPath to live update an app in Kubernetes

This repository is an experiment to solve a problem with developing a NodeJS micro service based
system that will be deployed to Kubernetes.

To have a representative deployment the team wish to use the same Helm charts to deploy to a Minikube
running locally, but for debug purposes they need to be running their local code.

To add to the complexity, the code lives in a Lerna monorepo, which means that when developing
locally there are symbolic links from the node_modules in the server module into other packages
in the repository.

The starting point for investigation will be a simple file watcher app, and then I will extend
it to cover a more representative example with multiple services depending on symlinked modules.

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

The file `basic-deployment.yml` will create a Deployment running a single pod using the
`local/watcher` image. **Note** The Pod template is defined with an `ImagePullPolicy` of
`Never` to ensure the locally built version is used.

The following command will deploy the pod and start following the logs:

```
kubectl apply -f basic-deployment.yml
kubectl logs -l app=monitor -f
```

Now exec into the container with the following command:

```
kubectl exec -it deploy/monitor-deployment -- /bin/bash
```

And modify files in the monitor folder to see watcher output.

```
touch monitor/foo.txt
```

### Clean up

To clean up, delete the pod by running:

```
kubectl delete deployment monitor-deployment
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
kubectl logs -l app=monitor -f
```

If you modify files in the `watcher/monitor` folder on your host you
should see files messages appear in the logs. This demonstrates that
events are fired inside the running container for changes on the host.

### Clean up

To clean up, remove the pod, claim and volume by running

```
kubectl delete deployment monitor-deployment
kubectl delete pvc monitor-claim
kubectl delete pv monitor-volume
```

## Updating a running deployment to use a mount

The Peristent Volume and Persistent Volume Claim can be deployed separately
to the app. The file `local-volume.yml` can do this if applied with

```
sed "s|CHANGE ME|$PWD/watcher/monitor|" local-volume.yml | kubectl apply -f -
```

Deploy the basic deployment (so no mounted volume), and start following the logs:

```
kubectl apply -f basic-deployment.yml
kubectl logs -l app=monitor -f
```

Changing files on the host will have no effect at this point.

We can then use `kubectl patch` to update the Pod template defined in our Deployment to include
the mount.

```
kubectl patch deployment monitor-deployment --patch "$(cat add-mount.yml)"
```

If you change files in the `watcher/monitor` folder you will see it reflected in the log output.

## Update deployment for live update

To show live updating of our service based upon the code we need to make use of a tool like
[nodemon](https://nodemon.io). The same approach to patching a deployment can be used for this,
we need patch the deployment so it is our local code that is being run, and also to switch
out the base image to use `nodemon` to run the code.

### nodemon image

The folder `nodemon` contains a simple Dockerfile that installs `nodemon` into a node base image.
From the root of the repository, build the image using:

```
cd nodemon
docker build -t local/nodemon .
```

### Create a source volume

Use the following command to create a source volume.

```
sed "s|CHANGE ME|$PWD/watcher|" source-volume.yml | kubectl apply -f -
```

### Patch the deployment

Now we can patch the deployment to do the following:

1. Mount the PVC at `/mounted/source`
2. Change the workingDir to be `/mounted/source` (so we definitely run local code)
3. Change the base image to be `local/nodemon`
4. Change the `command` and `args` so the container runs the command `nodemon server.js`.

Run the patch with the following command:

```
kubectl patch deployment monitor-deployment --patch "$(cat add-live-updating.yml)"
```

Once the deployment has completed and the pod is running, you follow the logs using

```
kubectl logs -f deployment/monitor-deployment
```

The output should now include the lines like:

```
[nodemon] 2.0.7
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node server.js`
```

If you change the file `server.js` on the host you should see output like

```
[nodemon] restarting due to changes...
[nodemon] starting `node server.js`
```

# Further notes

## What about lerna?

The starting point for this investigation was to support `lerna`, but the
examples do not make use of it - what gives?

Once you can mount a local path into your pod and also configure the working
directory it turns out that symbolic links as used by `lerna bootstrap` are
a non-issue.

If using a monorepo you should mount the root of the repo into your Pod
but set the workingDir into the package you wish to run. This will mean that
any symbolic links can still be resolved as they are created with relative paths and the entire monorepo is available in the Pod.

## Configuring nodemon

This example runs nodemon in a pretty vanilla manner. There are various additional options that might be useful such as configuring which folders are monitored, specifying files to ignore, and controlling the time between a change being noticed and the restart. Depending on your workflow you may want to configure these to improve performance.

## Possible Minikube complexities

**Note** I have done limited testing with Minikube - caveat emptor!

### Mounting local files

All of the examples in this repository have been run in Docker Desktop for Mac.
There may be further complexities if running in (for example) Minikube because
Docker Desktop does some sharing from the macos host to the VM running k8s
automatically.

It appears that Minikube needs to be started with the `--mount-string` option
to enable this - see this
[Stack Overflow](https://stackoverflow.com/questions/48534980/mount-local-directory-into-pod-in-minikube) answer.

To ensure consistency for multiple developers it might make sense to translate from where code
lives on the host to a consistent location (e.g `/mnt/source`) inside of minikube. Then all yml
files that are used to patch the running deployment can use the consistent paths:

```
minikube start -p minikube --driver=docker --mount-string="/local/path/to/repository:/mnt/source/repository" --mount
```

**Notes**

1. The docker driver does not appear to allow you to change the mount on a running node, you may need run `minikube delete` to remove your existing node
2. At least with the version of minikube and the docker driver that I tested with, the `--mount` and
   `--mount-string` options only worked when a profile is specified, _even_ if the profile name supplied
   is the same as the default.

### Accessing locally built images

While Docker Desktop for Mac makes locally built images available immediately inside the k8s cluster
the same is not true for minikube unless you are using the `none` driver.
There are various suggested options to make images available, possibly the simplest is to run
something like the followin after your image has been built and tagged.

```
minikube image add local/nodemon
```

Further options [here](https://minikube.sigs.k8s.io/docs/handbook/pushing/)
