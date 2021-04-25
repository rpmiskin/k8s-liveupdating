#/bin/bash
kubectl delete deployment monitor-deployment 
kubectl delete pvc monitor-claim
kubectl delete pv monitor-volume
