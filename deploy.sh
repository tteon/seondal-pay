#!/bin/bash
set -e

# Add local gcloud installation to PATH
export PATH="$PATH:/home/hadry/google-cloud-sdk/bin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}    GCP Cloud Run + Cloud SQL + GCS Deployment    ${NC}"
echo -e "${BLUE}==================================================${NC}"

# 1. Detect GCP Project ID
echo -e "\n${YELLOW}Detecting GCP Project ID...${NC}"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No active GCP project configured in gcloud CLI.${NC}"
    read -p "Please enter your GCP Project ID: " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Deployment aborted: Project ID is required.${NC}"
    exit 1
fi

echo -e "${GREEN}Using GCP Project ID: ${PROJECT_ID}${NC}"

# Define resource names
REGION="us-central1"
SQL_INSTANCE="my-db-instance"
DB_NAME="app_db"
DB_USER="db_user"
GCS_BUCKET="scraped-data-bucket-${PROJECT_ID}" # Appends project ID to ensure global uniqueness

# Prompt for database password if not set in environment
if [ -z "$DB_PASS" ]; then
    echo -e "\n${YELLOW}Database Configuration:${NC}"
    read -s -p "Enter password for database user '${DB_USER}': " DB_PASS
    echo ""
else
    echo -e "\n${GREEN}Using DB_PASS from environment variable.${NC}"
fi

# ----------------------------------------------------
# Step 1. Enable Required APIs
# ----------------------------------------------------
echo -e "\n${YELLOW}[Step 1/5] Enabling GCP APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    storage.googleapis.com \
    stitch.googleapis.com \
    --project="${PROJECT_ID}" || echo -e "${YELLOW}Warning: Could not enable APIs via gcloud. Proceeding assuming they are already enabled in the console...${NC}"

echo -e "${GREEN}APIs enabling step processed!${NC}"

# ----------------------------------------------------
# Step 2. Create Cloud SQL (PostgreSQL 15) Instance
# ----------------------------------------------------
echo -e "\n${YELLOW}[Step 2/5] Creating Cloud SQL PostgreSQL instance...${NC}"
echo -e "${BLUE}Instance Name: ${SQL_INSTANCE}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"
echo -e "${BLUE}Tier: db-f1-micro (Shared-core, cheapest)${NC}"

# Check if instance already exists to avoid error
if gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -e "${YELLOW}Cloud SQL instance '${SQL_INSTANCE}' already exists. Skipping creation...${NC}"
else
    gcloud sql instances create "${SQL_INSTANCE}" \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region="${REGION}" \
        --project="${PROJECT_ID}"
    echo -e "${GREEN}Cloud SQL instance created!${NC}"
fi

# Create Database inside instance
echo -e "\nCreating database '${DB_NAME}'..."
if gcloud sql databases describe "${DB_NAME}" --instance="${SQL_INSTANCE}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -e "${YELLOW}Database '${DB_NAME}' already exists. Skipping...${NC}"
else
    gcloud sql databases create "${DB_NAME}" \
        --instance="${SQL_INSTANCE}" \
        --project="${PROJECT_ID}"
fi

# Create User inside instance
echo -e "\nCreating user '${DB_USER}'..."
if gcloud sql users describe "${DB_USER}" --instance="${SQL_INSTANCE}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -e "${YELLOW}User '${DB_USER}' already exists. Updating password...${NC}"
    gcloud sql users set-password "${DB_USER}" \
        --instance="${SQL_INSTANCE}" \
        --password="${DB_PASS}" \
        --project="${PROJECT_ID}"
else
    gcloud sql users create "${DB_USER}" \
        --instance="${SQL_INSTANCE}" \
        --password="${DB_PASS}" \
        --project="${PROJECT_ID}"
fi

echo -e "${GREEN}Cloud SQL Database & User configured!${NC}"

# ----------------------------------------------------
# Step 3. Create GCS Bucket
# ----------------------------------------------------
echo -e "\n${YELLOW}[Step 3/5] Creating GCS bucket...${NC}"
echo -e "${BLUE}Bucket Name: gs://${GCS_BUCKET}${NC}"

if gcloud storage buckets describe "gs://${GCS_BUCKET}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -e "${YELLOW}Bucket '${GCS_BUCKET}' already exists. Skipping creation...${NC}"
else
    gcloud storage buckets create "gs://${GCS_BUCKET}" \
        --location="${REGION}" \
        --default-storage-class=STANDARD \
        --project="${PROJECT_ID}"
    echo -e "${GREEN}GCS Bucket created!${NC}"
fi

# ----------------------------------------------------
# Step 4. Cloud Run Deploy
# ----------------------------------------------------
echo -e "\n${YELLOW}[Step 4/5] Deploying App to Google Cloud Run...${NC}"
echo -e "${BLUE}Building container image and deploying...${NC}"

# Deploy the application using source-to-image build
gcloud run deploy solana-paysh-app \
    --source . \
    --region="${REGION}" \
    --allow-unauthenticated \
    --add-cloudsql-instances="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}" \
    --set-env-vars="DB_USER=${DB_USER},DB_PASS=${DB_PASS},DB_NAME=${DB_NAME},INSTANCE_CONNECTION_NAME=${PROJECT_ID}:${REGION}:${SQL_INSTANCE},GCS_BUCKET=${GCS_BUCKET}" \
    --project="${PROJECT_ID}" \
    --quiet

echo -e "\n${GREEN}==================================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}==================================================${NC}"
echo -e "Use the returned Cloud Run URL above to check your Live Web Dashboard."
