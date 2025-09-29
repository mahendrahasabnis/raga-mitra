# Domain Verification Steps for raga.99platforms.com

## 🔍 Current Issue
The domain verification in Google Search Console needs to be linked to Google Cloud for the domain mapping to work.

## 📋 Step-by-Step Solution

### Step 1: Complete Domain Verification in Google Cloud

Since the command opened Google Search Console, follow these steps:

1. **In the opened Google Search Console tab:**
   - Make sure you're signed in as `admin@neoabhro.com`
   - Add property: `raga.99platforms.com`
   - Choose "Domain" verification method
   - Follow the DNS verification steps

2. **Alternative: Verify Parent Domain**
   - If `99platforms.com` is already verified, you can use it for subdomains
   - In Google Search Console, go to the verified `99platforms.com` property
   - Add `raga.99platforms.com` as a subdomain

### Step 2: Link Verification to Google Cloud

After verification in Search Console:

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Select project: `raga-mitra`
   - Go to: Security > Domain Verification

2. **Add Domain:**
   - Click "Add Domain"
   - Enter: `raga.99platforms.com`
   - Choose verification method (DNS or HTML file)
   - Complete verification

### Step 3: Create Domain Mapping

After domain is verified in Google Cloud, run:

```bash
gcloud beta run domain-mappings create \
  --service=ragamitra-frontend-dev \
  --domain=raga.99platforms.com \
  --region=asia-south1
```

### Step 4: Get DNS Records

```bash
gcloud beta run domain-mappings describe \
  --domain=raga.99platforms.com \
  --region=asia-south1
```

### Step 5: Configure DNS

Add the CNAME record to your DNS provider for `99platforms.com`:
- Name: `raga`
- Type: `CNAME`
- Value: [Target URL from step 4]

## 🚀 Quick Alternative: Manual DNS Setup

If verification is taking too long, you can manually set up DNS:

1. **Add CNAME Record:**
   ```
   Name: raga
   Type: CNAME
   Value: ragamitra-frontend-dev-bnbuvw3hkq-el.a.run.app
   TTL: 3600
   ```

2. **Test Access:**
   - Wait 5-30 minutes for DNS propagation
   - Visit: https://raga.99platforms.com

## 🔍 Troubleshooting

- **Domain not verified**: Complete verification in both Search Console and Google Cloud
- **DNS not working**: Check CNAME record points to correct Cloud Run URL
- **SSL issues**: Cloud Run automatically handles SSL certificates for custom domains
