# YouTube Integration Setup Guide

## 🎯 **Overview**
This guide will help you set up YouTube Data API v3 integration for the Raga-Mitra application to search for classical music videos.

## 📋 **Prerequisites**
- Google Cloud Console account
- YouTube Data API v3 enabled
- Valid API key with sufficient quota

## 🔧 **Step 1: Google Cloud Console Setup**

### 1.1 Create a New Project (if needed)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `raga-mitra-youtube`
4. Click "Create"

### 1.2 Enable YouTube Data API v3
1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "YouTube Data API v3"
3. Click on it and press "Enable"

### 1.3 Create API Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the generated API key
4. (Optional) Restrict the API key to YouTube Data API v3 for security

## 🔑 **Step 2: Configure Environment Variables**

### 2.1 Update `.env` file
Add the following to your `.env` file in the backend directory:

```env
# YouTube API Configuration
YOUTUBE_API_KEY=your-youtube-api-key-here
YOUTUBE_SEARCH_QUOTA=10000
YOUTUBE_MAX_RESULTS=50
YOUTUBE_MIN_DURATION=1800
```

### 2.2 Example Configuration
```env
YOUTUBE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
YOUTUBE_SEARCH_QUOTA=10000
YOUTUBE_MAX_RESULTS=20
YOUTUBE_MIN_DURATION=1800
```

## 🚀 **Step 3: Test the Integration**

### 3.1 Start the Backend
```bash
cd backend
npm run dev
```

### 3.2 Test YouTube Search API
```bash
curl -X GET "http://localhost:3001/api/tracks/youtube/search?raga=Bageshri&artist=Ravi%20Shankar" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3.3 Check Quota Status
```bash
curl -X GET "http://localhost:3001/api/tracks/youtube/quota" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📊 **API Endpoints**

### Search YouTube Tracks
```
GET /api/tracks/youtube/search
```

**Query Parameters:**
- `raga` (required): Raga name to search for
- `artist` (optional): Artist name to filter by
- `minDuration` (optional): Minimum duration in seconds (default: 1800)
- `maxResults` (optional): Maximum number of results (default: 20)
- `orderBy` (optional): Sort order (relevance, date, rating, viewCount)

**Example:**
```
GET /api/tracks/youtube/search?raga=Yaman&artist=Pandit%20Ravi%20Shankar&minDuration=1800&maxResults=10
```

### Get Quota Status
```
GET /api/tracks/youtube/quota
```

**Response:**
```json
{
  "used": 150,
  "limit": 10000,
  "remaining": 9850
}
```

## 🎵 **Features**

### Classical Music Filtering
- Automatically filters for classical music content
- Excludes Bollywood, pop, rock, and other non-classical genres
- Searches for raga-specific keywords
- Prioritizes live performances and concerts

### Duration Filtering
- Default minimum duration: 30 minutes
- Configurable via API parameters
- Filters out short clips and snippets

### Quality Filtering
- Prioritizes high-definition videos
- Focuses on long-form content
- Sorts by relevance and engagement

### Caching
- Results are cached in MongoDB
- Reduces API quota usage
- Faster subsequent searches

## ⚠️ **Quota Management**

### Daily Quota Limits
- **Free Tier**: 10,000 units per day
- **Search Operation**: 100 units per request
- **Video Details**: 1 unit per video

### Quota Usage Examples
- 1 search with 10 videos = 110 units
- 100 searches per day = 11,000 units (exceeds free tier)

### Best Practices
1. Use caching to reduce API calls
2. Implement search result pagination
3. Monitor quota usage regularly
4. Consider upgrading to paid tier for production

## 🔒 **Security Considerations**

### API Key Protection
1. Never commit API keys to version control
2. Use environment variables
3. Restrict API key to specific APIs
4. Consider IP restrictions for production

### Rate Limiting
- Implement client-side rate limiting
- Add server-side request throttling
- Monitor and alert on quota usage

## 🐛 **Troubleshooting**

### Common Issues

#### 1. "YouTube API key not configured"
- Check if `YOUTUBE_API_KEY` is set in `.env`
- Restart the backend server
- Verify the API key is valid

#### 2. "YouTube API quota exceeded"
- Check quota usage: `GET /api/tracks/youtube/quota`
- Wait for quota reset (daily at midnight PST)
- Consider upgrading to paid tier

#### 3. "No suitable tracks found"
- Try different raga/artist combinations
- Adjust `minDuration` parameter
- Check if the search terms are too specific

#### 4. "Failed to search YouTube"
- Verify API key permissions
- Check internet connectivity
- Review server logs for detailed errors

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=youtube:*
```

## 📈 **Monitoring**

### Quota Monitoring
- Check quota status before major operations
- Implement alerts for quota usage > 80%
- Track daily usage patterns

### Performance Monitoring
- Monitor API response times
- Track cache hit rates
- Log search success/failure rates

## 🚀 **Production Deployment**

### Environment Variables
Set these in your production environment:
```env
YOUTUBE_API_KEY=your-production-api-key
YOUTUBE_SEARCH_QUOTA=100000
YOUTUBE_MAX_RESULTS=50
YOUTUBE_MIN_DURATION=1800
```

### Scaling Considerations
- Implement Redis caching for better performance
- Use multiple API keys with load balancing
- Consider YouTube Premium API for higher quotas
- Implement fallback to cached results

## 📚 **Additional Resources**

- [YouTube Data API v3 Documentation](https://developers.google.com/youtube/v3)
- [Google Cloud Console](https://console.cloud.google.com/)
- [API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Best Practices Guide](https://developers.google.com/youtube/v3/guides/implementation)

## 🆘 **Support**

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs for error details
3. Verify API key configuration
4. Test with a simple search query first

---

**Note**: This integration requires a valid YouTube Data API v3 key. The free tier provides 10,000 units per day, which should be sufficient for development and small-scale production use.
