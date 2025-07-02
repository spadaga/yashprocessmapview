### **Complete Azure Deployment Documentation**

## Process Map Viewer - Next.js Application

Based on your successful deployment, here's the comprehensive documentation for both initial and incremental deployments.

---

## 🚀 **Initial Deployment Setup (One-Time)**

### **Prerequisites**

- Azure subscription with App Service created
- GitHub repository: `https://github.com/spadaga/yashprocessmapview.git`
- Azure CLI access (via Cloud Shell or local installation)


### **Resource Details**

- **Resource Group**: `processmap-viewer-rg`
- **App Service**: `processmap-viewer-app`
- **Region**: Southeast Asia
- **App URL**: `http://processmap-viewer-app-e6asdsd4bwasepg4.southeastasia-01.azurewebsites.net`


Azure Cloud Shell Setup

# Create project directory
mkdir processmap-viewer
cd processmap-viewer

# Clone the repository
git clone https://github.com/spadaga/yashprocessmapview.git processmap-viewer
cd processmap-viewer


Configure Azure App Service Settings

# Set correct build settings for Next.js deployment
az webapp config appsettings set \
  --resource-group processmap-viewer-rg \
  --name processmap-viewer-app \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true WEBSITE_RUN_FROM_PACKAGE=0


  Initial Deployment


  # Create deployment package
zip -r app-deploy.zip . -x "node_modules/*" ".git/*" "*.zip"

# Deploy to Azure
az webapp deploy \
  --resource-group processmap-viewer-rg \
  --name processmap-viewer-app \
  --src-path app-deploy.zip \
  --type zip

  ## **Incremental Deployment Process**

### **Method 1: Manual Deployment (Recommended)**

#### **Step 1: Update Code Locally**


# Make your changes locally
# Test changes with: npm run dev
# Commit to GitHub
git add .
git commit -m "bg color -heade"
git push origin main


#### **Deploy via Azure Cloud Shell**

# Navigate to project directory

mkdir processmap-viewer
cd processmap-viewer
or--------
cd ~/processmap-viewer/processmap-viewer

git clone https://github.com/spadaga/yashprocessmapview.git processmap-viewer


az webapp deploy \
  --resource-group processmap-viewer-rg \
  --name processmap-viewer-app \
  --src-path app-deploy.zip \
  --type zip


  ------------------------------------
  satya [ ~ ]$ mkdir processmap-viewer
cd processmap-viewer
  satya [ ~/processmap-viewer ]$ git clone https://github.com/spadaga/yashprocessmapview.git processmap-viewer
satya [ ~/processmap-viewer ]$ cd processmap-viewer
  satya [ ~/processmap-viewer/processmap-viewer ]$
  > zip -r app-deploy.zip . -x "node_modules/*" ".git/*" "*.zip"

  satya [ ~/processmap-viewer/processmap-viewer ]$ az webapp deploy \
  --resource-group processmap-viewer-rg \
  --name processmap-viewer-app \
  --src-path app-deploy.zip \
  --type zip


  ---------------------------------

# Pull latest changes from GitHub
git pull origin main

# Create and deploy in one command
zip -r app-deploy-latest.zip . -x "node_modules/*" ".git/*" "*.zip" && \
az webapp deploy \
  --resource-group processmap-viewer-rg \
  --name processmap-viewer-app \
  --src-path app-deploy-latest.zip \
  --type zip


  One-Liner Deployment

  cd ~/processmap-viewer/processmap-viewer && git pull origin main && zip -r app-deploy-latest.zip . -x "node_modules/*" ".git/*" "*.zip" && az webapp deploy --resource-group processmap-viewer-rg --name processmap-viewer-app --src-path app-deploy-latest.zip --type zip

  Check Deployment Status


  # View deployment logs
az webapp log tail --resource-group processmap-viewer-rg --name processmap-viewer-app

# Check app settings
az webapp config appsettings list --resource-group processmap-viewer-rg --name processmap-viewer-app



### **Troubleshooting Commands**

```
# Restart the app
az webapp restart --resource-group processmap-viewer-rg --name processmap-viewer-app

# View recent deployments
az webapp deployment list --resource-group processmap-viewer-rg --name processmap-viewer-app

```

**App URL**: [http://processmap-viewer-app-e6asdsd4bwasepg4.southeastasia-01.azurewebsites.net](http://processmap-viewer-app-e6asdsd4bwasepg4.southeastasia-01.azurewebsites.net)
**GitHub Repository**: [https://github.com/spadaga/yashprocessmapview.git](https://github.com/spadaga/yashprocessmapview.git)
**Azure Resource Group**: processmap-viewer-rg
**Azure App Service**: processmap-viewer-app