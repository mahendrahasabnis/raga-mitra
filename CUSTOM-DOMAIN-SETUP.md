# Custom Domain Setup for RagaMitra

## 🌐 Setting up `raga.99platforms.com` for Frontend

This guide will help you set up the custom domain `raga.99platforms.com` to point to your deployed RagaMitra frontend.

### 📋 Current Status
- **Frontend URL**: https://ragamitra-frontend-dev-873534819669.asia-south1.run.app
- **Target Domain**: raga.99platforms.com
- **Project**: raga-mitra
- **Service**: ragamitra-frontend-dev
- **Region**: asia-south1

### 🔧 Prerequisites
- Access to Google Cloud Console (admin@neoabhro.com)
- Access to DNS management for 99platforms.com domain
- Google Search Console access

---

## 📝 Step-by-Step Setup Process

### Step 1: Domain Verification in Google Search Console

1. **Go to Google Search Console**
   - Visit: https://search.google.com/search-console/welcome
   - Sign in with admin@neoabhro.com

2. **Add Property**
   - Click "Add Property"
   - Enter: `raga.99platforms.com`
   - Choose "Domain" (recommended over URL prefix)

3. **Verify Domain Ownership**
   - Choose verification method:
     - **DNS Record** (recommended): Add a TXT record to your DNS
     - **HTML File**: Upload an HTML file to your domain root
     - **HTML Tag**: Add a meta tag to your website's homepage

4. **DNS Record Method (Recommended)**
   - Copy the TXT record value provided by Google
   - Add it to your DNS provider for 99platforms.com:
     ```
     Type: TXT
     Name: @ (or raga.99platforms.com)
     Value: [Google's verification string]
     TTL: 3600 (or default)
     ```

5. **Complete Verification**
   - Click "Verify" in Google Search Console
   - Wait for verification (usually immediate to a few minutes)

### Step 2: Create Domain Mapping in Google Cloud

After domain verification is complete, run these commands:

```bash
# Set the correct project
gcloud config set project raga-mitra

# Create the domain mapping
gcloud beta run domain-mappings create \
  --service=ragamitra-frontend-dev \
  --domain=raga.99platforms.com \
  --region=asia-south1
```

### Step 3: Get DNS Configuration

After creating the domain mapping, get the DNS records:

```bash
# Get the domain mapping details
gcloud beta run domain-mappings describe \
  --domain=raga.99platforms.com \
  --region=asia-south1
```

This will show you the DNS records you need to add.

### Step 4: Configure DNS Records

Add the following DNS records to your 99platforms.com domain:

1. **CNAME Record** (provided by Google Cloud):
   ```
   Type: CNAME
   Name: raga
   Value: [Google Cloud's target URL]
   TTL: 3600
   ```

2. **A Records** (if required by Google Cloud):
   ```
   Type: A
   Name: raga
   Value: [IP addresses provided by Google Cloud]
   TTL: 3600
   ```

### Step 5: Wait for DNS Propagation

- DNS changes can take 5-30 minutes to propagate globally
- You can check propagation status at: https://dnschecker.org/

### Step 6: Test the Custom Domain

Once DNS propagation is complete:
- Visit: https://raga.99platforms.com
- Verify it loads the RagaMitra frontend correctly

---

## 🔍 Troubleshooting

### Domain Verification Issues
- Ensure the DNS record is correctly added
- Check TTL values (use 3600 seconds)
- Wait a few minutes for DNS propagation
- Try different verification methods if one fails

### Domain Mapping Issues
- Ensure domain is verified before creating mapping
- Check that all required APIs are enabled:
  ```bash
  gcloud services enable run.googleapis.com
  gcloud services enable websecurityscanner.googleapis.com
  gcloud services enable searchconsole.googleapis.com
  ```

### DNS Issues
- Verify CNAME record points to the correct Google Cloud URL
- Check for conflicting DNS records
- Ensure no other services are using the subdomain

---

## 📚 Useful Commands

```bash
# Check current domain mappings
gcloud beta run domain-mappings list --region=asia-south1

# Describe a specific domain mapping
gcloud beta run domain-mappings describe \
  --domain=raga.99platforms.com \
  --region=asia-south1

# Delete a domain mapping (if needed)
gcloud beta run domain-mappings delete \
  --domain=raga.99platforms.com \
  --region=asia-south1

# Check Cloud Run services
gcloud run services list --region=asia-south1
```

---

## 🔗 Additional Resources

- [Google Cloud Run Custom Domains](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Google Search Console](https://search.google.com/search-console)
- [DNS Checker](https://dnschecker.org/)

---

## ✅ Success Criteria

The setup is complete when:
1. ✅ Domain is verified in Google Search Console
2. ✅ Domain mapping is created in Google Cloud
3. ✅ DNS records are correctly configured
4. ✅ https://raga.99platforms.com loads the RagaMitra frontend
5. ✅ All functionality works as expected

---

*Last updated: September 29, 2025*
