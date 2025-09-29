# Manual DNS Setup for raga.99platforms.com

## 🚀 Quick Setup (Works Immediately)

Since domain verification can be complex, here's a direct DNS approach:

### Step 1: Add DNS Record

Add this CNAME record to your `99platforms.com` DNS:

```
Name: raga
Type: CNAME
Value: ragamitra-frontend-dev-bnbuvw3hkq-el.a.run.app
TTL: 3600 (or default)
```

### Step 2: Wait for DNS Propagation

- DNS changes take 5-30 minutes to propagate
- Check status at: https://dnschecker.org/

### Step 3: Test Access

Visit: https://raga.99platforms.com

## 🔍 Current Cloud Run Service

- **Service**: ragamitra-frontend-dev
- **URL**: https://ragamitra-frontend-dev-bnbuvw3hkq-el.a.run.app
- **Region**: asia-south1
- **Project**: raga-mitra

## ✅ Expected Result

Once DNS propagates, `https://raga.99platforms.com` will load your RagaMitra frontend with all features working.

## 🔧 Alternative: Cloud Run Domain Mapping (After Verification)

If you want to use Google Cloud's domain mapping (for better SSL management):

1. Complete domain verification in Google Cloud Console
2. Run: `gcloud beta run domain-mappings create --service=ragamitra-frontend-dev --domain=raga.99platforms.com --region=asia-south1`
3. Add the provided DNS records

## 📱 Testing

After DNS propagation, test:
- ✅ Frontend loads correctly
- ✅ Login functionality works
- ✅ Raga selection works
- ✅ Artist search works
- ✅ Clear search buttons work
- ✅ YouTube integration works
