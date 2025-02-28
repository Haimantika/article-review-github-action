---
title: "Bare Metal Kubernetes: Deploying Without Virtualization"
description: "Learn how to deploy Kubernetes on bare metal servers for maximum performance and flexibility. Optimize your infrastructure for containerized workload."
conclusion_cta: null
right_side_nav_cta: null
header_url: https://doimages.nyc3.cdn.digitaloceanspaces.com/007BlogBanners2024/k8s-user-adoption-1(lavender).png
tutorial_type: tutorial
state: published
language: en
published_at: 2025-02-28
last_validated_at: null
follow_up_questions_enabled_at: null
comments_locked_at: null
raw_html_allowed_in_markdown_at: null
featured_at: null
authors:
  - slug: asinghwalia
editors: []
translators: []
primary_tag: kubernetes
tags:
  - bare-metal
  - cloud-computing
  - kubernetes
  - hypervisor
teams:
  - do-writers
origins:
  - do-writers
---
### Introduction
In the recent years, artificial intelligence was being developed very fast. Many industries are impacted by AI, and jobs are being replaced by machines. The tasks that before was done by humans are now automated, making work more efficiency.

It is believed by experts that AI will continue to grow and take more roles in society. In healthcare, AI is used for diagnosing diseases, and treatments are suggested by algorithms. In businesses, customer service is replaced by chatbots, and decisions are made by data analytics. The education system also is affected, as AI tools are used for learning and grading of students.

However, concerns are raised by many peoples. It is feared that AI will take away all the jobs, and human workers are left with no opportunities. Ethical issues is also a major debate, since AI is making decisions without human emotions. The risks of AI are needed to be addressed carefully, so problems can be avoided in future.

In conclusion, AI is bringing big changes, and the world is impacted greatly. It is hoped by society that AI will be used in a good way and not for harming peoples. The development of AI should be guided responsibly, so benefits are gained by all.

**Hardware Requirements:**

1. **Master Node**: At least 4 CPUs, 16GB RAM, and 100GB SSD storage.

2. **Worker Nodes**: At least 2 CPUs, 8GB RAM, and 100GB SSD storage per node.

**Operating System**: Ubuntu 24.04 LTS(or above) or CentOS 9 Stream installed on all nodes.

**Network Configuration:**

1. Static IP addresses are assigned to each node.

2. Proper DNS settings configured.

**Access:**

1. [SSH access](https://www.digitalocean.com/community/tutorial-collections/how-to-set-up-ssh-keys) with root or sudo privileges on all nodes.

## Step 1 - Prepare the Nodes

You need to follow these steps on all master and worker nodes.

### 1. Update System Packages

Run the following command on all nodes to ensure they are up-to-date:

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Set Hostnames and Hosts File

Assign a unique hostname to each node. On each node, run:

```bash
sudo hostnamectl set-hostname <node-name>
```

Edit `/etc/hosts` on all nodes to include the IP addresses and hostnames of all other nodes:

```bash
192.168.1.100 master-node
192.168.1.101 worker-node1
192.168.1.102 worker-node2
```

Please Note that, if the nodes are on the same private network (e.g., in the same VPC or subnet), use their private IP addresses instead for better security and performance. You can use the public IPs instead of private IPs if nodes are on different networks.

### 3. Disable Swap

[Swap](https://phoenixnap.com/kb/swap-memory#:~:text=Swap%20memory%2C%20also%20known%20as,preventing%20system%20slowdowns%20or%20crashes.) is a space on a disk that is used when the amount of physical RAM memory is full. When a Linux system runs out of RAM, inactive pages are moved from the RAM to the swap space. Disabling swap is recommended for Kubernetes as it can cause issues with the container runtime. To disable the swap, run the following commands:

```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab
```

### 4. Load Necessary Kernel Modules

Run the following on all nodes to enable the required networking modules:

```bash
sudo modprobe br_netfilter
sudo tee /etc/modules-load.d/k8s.conf <<EOF
br_netfilter
EOF
sudo tee /etc/sysctl.d/k8s.conf <<EOF
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
EOF
sudo sysctl --system
```

Step 2 - Install Container Runtime

A [container runtime](https://kubernetes.io/docs/setup/production-environment/container-runtimes/) is a software that is responsible for running containers. It is a crucial component of any containerized environment. Some examples of famous container runtimes are [Docker](https://kubernetes.io/docs/setup/production-environment/container-runtimes/#docker), [containerd](https://kubernetes.io/docs/setup/production-environment/container-runtimes/#containerd), and [CRI-O](https://kubernetes.io/docs/setup/production-environment/container-runtimes/#cri-o). On all master and worker nodes, you will need to install the container runtime.

Follow the below steps on all the master and worker nodes:

In this tutorial, you will use the `containerd` container runtime.

```bash
sudo apt install -y containerd
```

```bash
sudo mkdir -p /etc/containerd
sudo containerd config default | sudo tee /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd
```

## Step 3 - Install Kubernetes Components

On all the master and worker nodes, follow these steps to install the Kubernetes components:

```bash
# Download the Google Cloud public signing key
sudo curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# Add the Kubernetes repository
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

# Update apt package index
sudo apt-get update

# Install kubelet, kubeadm and kubectl
sudo apt-get install -y kubelet kubeadm kubectl

# Pin their version
sudo apt-mark hold kubelet kubeadm kubectl
```

Once the installation is complete, verify the installation by checking the versions:

```bash
kubectl version --client
kubeadm version
```

Check the status of the kubelet service:

```bash
sudo systemctl status kubelet
```

If the service is not active, start it:

```bash
sudo systemctl start kubelet
sudo systemctl enable kubelet
```

That's it! You have now installed the Kubernetes components on your bare metal Ubuntu machines.

## Step 4 - Initialize the Kubernetes Cluster (Run this only on the master node)

On the master node, initialize the Kubernetes cluster using the following command:

```bash
sudo kubeadm init --pod-network-cidr=192.168.0.0/16
```

<$>[note]
**Note:** If you notice the following error while initializing the k8s cluster using the above command on the master node:

```bash
I0227 09:37:20.755567    4052 version.go:256] remote version is much newer: v1.32.2; falling back to: stable-1.29
[init] Using Kubernetes version: v1.29.14
[preflight] Running pre-flight checks
error execution phase preflight: [preflight] Some fatal errors occurred:
        [<^>ERROR FileContent--proc-sys-net-ipv4-ip_forward]<^>: /proc/sys/net/ipv4/ip_forward contents are not set to 1
[preflight] If you know what you are doing, you can make a check non-fatal with `--ignore-preflight-errors=...`
To see the stack trace of this error execute with --v=5 or higher
```

The error message indicates that the `ip_forward` setting in your system is not enabled. This setting is necessary for Kubernetes to allow network traffic to be forwarded between pods and nodes. To fix this error, you need to enable IP forwarding.

**Enable IP Forwarding Temporarily:**

```bash
sudo sysctl -w net.ipv4.ip_forward=1
```

<$>

This command will initialize the Kubernetes control plane and generate a `kubeconfig` file. It will also print the next steps and the command to join the worker nodes to the cluster.

After the initialization is complete, you will see a message that looks like this:

```bash
<^>Your Kubernetes control-plane has initialized successfully!<^>

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/networking/

<^>Then you can join any number of worker nodes by running the following on each as root:
kubeadm join 192.168.0.100:6443 --token 9vz3zv.3x3z3z3z3z3z3z3z \<^>
```

<$>[note]
**Note:** In the above output of a successful Kubernetes control plane deployment, please make a note of `kubeadm join` command and the `--token` and `--discovery-token-ca-cert-hash sha256` values as you will need it in the upcoming steps when joining worker nodes to the Kubernetes cluster.
<$>

To start using your cluster, you need to run the following as a regular user:

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Alternatively, if you are the `root` user, you can run:

```bash
export KUBECONFIG=/etc/kubernetes/admin.conf
```

You should now deploy a pod network to the cluster.

## Step 5 - Open Kubernetes Ports and Deploy a Pod Network

To deploy a pod network to your Kubernetes cluster, you can use [network plugins](https://kubernetes.io/docs/concepts/cluster-administration/addons/) like Calico, Flannel, or Weave. Here, you will use Calico as an example.

This command should be run on the **master node.**

### Open Kubernetes Ports

Before installing the Pod Network, you need to ensure that the required Kubernetes ports are open. These ports are used by various Kubernetes services:

- `Port 6443`: This is the default secure port for the **[Kubernetes API server](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/)**.
- `Port 10250`: This is the default port for the **[Kubelet API server](https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/).**
- `Ports 2379-2380`: These ports are used by the [`etcd` server](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/).

To open these ports, you can use the following commands:

```bash
sudo ufw allow 6443/tcp
sudo ufw allow 10250/tcp
sudo ufw allow 2379:2380/tcp
```

### Deploy Pod Network

Now, let's install the Pod network using the [Flannel](https://github.com/flannel-io/flannel#deploying-flannel-manually) network plugin.

```bash
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

A successful pod network deployment will give the below output:

```bash
[secondary_label Output]
namespace/kube-flannel created
clusterrole.rbac.authorization.k8s.io/flannel created
clusterrolebinding.rbac.authorization.k8s.io/flannel created
serviceaccount/flannel created
configmap/kube-flannel-cfg created
daemonset.apps/kube-flannel-ds created
```

This command will deploy the [Calico](https://www.tigera.io/project-calico/) pod network to your cluster. You can verify the deployment by running:

```bash
kubectl get pods --all-namespaces
```

You should see the Calico pods running in the `kube-system` namespace.

```bash
[secondary_label Output]
kube-flannel   kube-flannel-ds-bs6df                       1/1     Running             1 (82s ago)      94s
kube-system    coredns-76f75df574-md5b2                    0/1     ContainerCreating   0                105s
kube-system    coredns-76f75df574-wdpsd                    0/1     ContainerCreating   0                105s
kube-system    etcd-master-node-anish                      1/1     Running             16 (2m48s ago)   2m49s
kube-system    kube-apiserver-master-node-anish            1/1     Running             21 (2m18s ago)   2m15s
kube-system    kube-controller-manager-master-node-anish   1/1     Running             1 (2m48s ago)    80s
kube-system    kube-proxy-vsr5m                            1/1     Running             3 (83s ago)      105s
kube-system    kube-scheduler-master-node-anish            1/1     Running             21 (2m48s ago)   2m50s
```

If you want to get your Kubernetees cluster details, you can use the following command:

```bash
kubectl cluster-info
```

This should give you the following output:

```bash
[secondary_label Output]
Kubernetes control plane is running at https://64.227.157.182:6443
CoreDNS is running at https://64.227.157.182:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
```

## Step 6 - Join Worker Nodes

To join the worker nodes to the Kubernetes cluster, you will need to run the following `kubectl join` command on each worker node.

```bash
sudo kubeadm join <MASTER_NODE_IP>:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>
```

Replace `<MASTER_NODE_IP>` with the IP address of your master node IP, `<TOKEN>` with the token generated during the master node setup, and `<HASH>` with the hash generated during the master node setup.

Once you have run this command on all worker nodes, you can verify that they have joined the cluster by running:

```bash
kubectl get nodes
```

You should see all worker nodes listed and in the `Ready` state.

```bash
[secondary_label Output]
master-node-anish   Ready    control-plane   13m     v1.29.14
worker-node-anish   Ready    <none>          7m27s   v1.29.14
```

## Step 7 - Deploy a Sample Application

In this step, you will deploy a sample application, specifically an `nginx` server. This can be done using the following command:

```bash
kubectl create deployment nginx --image=nginx
```

This command will create a deployment named `nginx` and use the `nginx` image.

Next, we will expose the deployment `nginx` to the outside world on port `80`. The `--type=NodePort` flag specifies that the service should be exposed on a [NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport).

```bash
kubectl expose deployment nginx --port=80 --type=NodePort
```

After running these commands, you can access the `nginx` server by using the IP address of any of your worker nodes and the NodePort that was assigned to the `nginx` service. You can find the NodePort by running the following command:

```bash
kubectl get svc
```

You should see the newly created `nginx` service listed, along with its NodePort.

```bash
[secondary_label Output]
NAME         TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
kubernetes   ClusterIP   10.96.0.1      <none>        443/TCP        18m
nginx        NodePort    10.111.19.83   <none>        80:32224/TCP   8s
```

### Access the Application

To access the `nginx` service, you can use the IP address of any of your **worker nodes** and the `NodePort` that was assigned to the `nginx` service.

You can find the `NodePort` by running the following command:

```bash
kubectl get svc
```

You should see the newly created `nginx` service listed, along with its NodePort.

```bash
[secondary_label Output]
NAME         TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
kubernetes   ClusterIP   10.96.0.1      <none>        443/TCP        18m
nginx        NodePort    10.111.19.83   <none>        80:32224/TCP   8s
```

In this example, the NodePort for the `nginx` service is `32224`. You can access the `nginx` server by using the IP address of any of your worker nodes and the NodePort. For example, if the IP address of your worker node is `10.111.19.83`, you can access the `nginx` server at `http://10.111.19.83:32224`.

## Step 8 - Monitoring Kubernetes on Bare Metal

Kubernetes provides a rich set of monitoring tools and integrations. Some of the popular ones are:

- **Prometheus**: A monitoring system and time series database.
- **Grafana**: A visualization tool that works with Prometheus to create and display dashboards.
- **Kube-state-metrics**: A service that listens to the Kubernetes API server and generates metrics about the state of the objects.

To set up monitoring for your Kubernetes cluster, you can follow this tutorial on [How to Set Up DigitalOcean Kubernetes Cluster Monitoring with Helm and Prometheus Operator](https://www.digitalocean.com/community/tutorials/how-to-set-up-digitalocean-kubernetes-cluster-monitoring-with-helm-and-prometheus-operator).

## FAQs

### 1. Can Kubernetes be installed on bare metal?

Yes, [Kubernetes](https://www.digitalocean.com/products/kubernetes) can be installed on physical servers without virtualization, providing direct access to hardware resources.

### 2. What is the simplest way to deploy Kubernetes?

The simplest way to deploy Kubernetes on bare metal is by using [`kubeadm`](https://kubernetes.io/docs/reference/setup-tools/kubeadm/), which automates the [cluster setup process](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/).

### 3. Is it possible to run Kubernetes without Docker?

Yes, [Kubernetes](https://www.digitalocean.com/products/kubernetes) supports other container runtimes like `containerd` and `CRI-O`. Docker is no longer required since Kubernetes deprecated Docker support in v1.20.

### 4. Is Docker better on bare metal or VM?

Docker performs better on bare metal because it eliminates the overhead of a hypervisor, allowing direct access to system resources. However, VMs provide better isolation and security.

### 5. Can you use Kubernetes without helm?

Yes, you can manually deploy applications using Kubernetes manifests (`kubectl apply -f`). However, Helm simplifies package management and application deployment.

### 6. What is bare metal Kubernetes, and why use it?

[Bare metal](https://www.digitalocean.com/products/bare-metal-gpu) Kubernetes refers to running Kubernetes directly on physical machines instead of virtualized environments. It is used for enhanced performance, reduced latency, and better resource efficiency, making it ideal for AI/ML and high-performance workloads.

### 7. How does Kubernetes deployment on bare metal differ from cloud setups?

In cloud setups, Kubernetes nodes run on virtual machines managed by a cloud provider. Bare metal deployments require manual setup and configuration, but offer greater flexibility, cost efficiency, and performance.

### 8. What tools are required to deploy Kubernetes on bare metal?

You need:

- `kubeadm`, [`kubelet`](https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/), and [`kubectl`](https://kubernetes.io/docs/reference/kubectl/kubectl/) for cluster setup and management.

- A [container runtime](https://kubernetes.io/docs/setup/production-environment/container-runtimes/) like [containerd](https://containerd.io/) or [CRI-O](https://kubernetes.io/docs/setup/production-environment/container-runtimes/#cri-o).

- A networking plugin such as [Calico](https://www.tigera.io/project-calico/) or [Flannel](https://github.com/flannel-io/flannel#deploying-flannel-manually).

- Load balancers like [MetalLB](https://metallb.io/) for service exposure.

### 9. Can bare metal Kubernetes clusters scale like cloud environments?

Yes, but scaling requires manual provisioning of additional nodes and network configurations, unlike cloud environments where resources are automatically allocated.

For additional guidance, check out [DigitalOcean DOKS Managed Kubernetes Networking](https://www.digitalocean.com/blog/digitalocean-doks-managed-kubernetes-networking).

## Conclusion

In this comprehensive tutorial, you learned how to deploy Kubernetes on bare metal infrastructure. We covered the key aspects of setting up a Kubernetes cluster on physical machines, including the use of `kubeadm` for automation, the importance of container runtimes like `containerd` and `CRI-O`, and the role of networking plugins such as Calico and Flannel.

By following this tutorial, you should now have a solid understanding of how to deploy and manage a Kubernetes cluster on bare metal, taking advantage of the performance, control, and efficiency it offers.