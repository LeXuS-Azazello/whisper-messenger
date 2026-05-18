# Secure MongoDB Access Guide

This guide describes how to securely access the MongoDB instance running in your Kubernetes cluster (`debugging-testcrash-pub` namespace) using either the **native MongoDB Compass desktop application** or the **web-based Mongo Express interface** we just deployed.

---

## Method 1: Connecting your local MongoDB Compass (Recommended)

Since MongoDB Compass is a desktop application, the most secure and performance-efficient way to use it is by creating a secure tunnel via Kubernetes port-forwarding. This avoids exposing any ports publicly to the internet.

### Step-by-Step Connection:

1. **Establish the Secure Tunnel:**
   Open a terminal on your local machine and run the following command to tunnel traffic from port `27017` on your local machine directly into the MongoDB service in the cluster:
   ```bash
   kubectl port-forward svc/mongodb 27017:27017 -n debugging-testcrash-pub
   ```
   *(Keep this terminal window open to maintain the secure tunnel.)*

2. **Connect via MongoDB Compass:**
   - Launch your desktop **MongoDB Compass** application.
   - Click **New Connection**.
   - Paste the following connection string:
     ```connection-string
     mongodb://localhost:27017/voicemsg
     ```
   - Click **Connect**.
   - You now have full, high-performance secure GUI access to your database!

---

## Method 2: Accessing the Web-Based Mongo Express UI

For quick administrative tasks without launching a desktop app, we have deployed `mongo-express` inside the cluster. It is isolated as a `ClusterIP` service (completely secure from external access) and is protected by **Basic Authentication**.

### Step-by-Step Connection:

1. **Establish the Secure Tunnel:**
   Open a terminal on your local machine and run:
   ```bash
   kubectl port-forward svc/mongo-express 8081:8081 -n debugging-testcrash-pub
   ```
   *(Keep this terminal window open to maintain the secure tunnel.)*

2. **Access the Web Interface:**
   - Open your browser and go to: `http://localhost:8081`
   - A login prompt will appear.

3. **Login Credentials:**
   - **Username:** `admin`
   - **Password:** The value of `ADMIN_SECRET` configured in your `.env` (which is `H@jimeN@maste!`).

4. **Features Available:**
   - View, edit, add, or delete documents and collections.
   - View database stats and index sizes.
   - Simple, responsive web-based management.

---

## Deployment Instructions

To apply the new manifests to your Kubernetes cluster:

1. Run the deployment script to automatically mirror the `mongo-express` image and deploy the updated manifests:
   ```bash
   ./scripts/deploy.sh
   ```
   *(The deployment script will mirror the `mongo-express:latest` image to Harbor, update the image definitions, and run `kubectl apply -k kubernetes/base`.)*

2. Verify that both MongoDB and Mongo Express are up and running:
   ```bash
   kubectl get pods -n debugging-testcrash-pub -l app=mongo-express
   ```
