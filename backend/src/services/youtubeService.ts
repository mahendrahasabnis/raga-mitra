import axios from 'axios';
import { google } from 'googleapis';
import Track from '../models/Track';

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  url: string;
  durationSeconds: number;
}

interface SearchFilters {
  minDuration?: number; // in seconds
  maxResults?: number;
  orderBy?: 'relevance' | 'date' | 'rating' | 'viewCount';
  videoDefinition?: 'any' | 'high' | 'standard';
  videoDuration?: 'any' | 'short' | 'medium' | 'long';
}

class YouTubeService {
  private apiKey: string;
  private youtube: any;
  private quotaUsed: number = 0;
  private quotaLimit: number;

  constructor() {
    // Initialize with empty values, will be set when first used
    this.apiKey = '';
    this.quotaLimit = 10000;
    this.youtube = null;
  }

  private initialize() {
    if (this.youtube) return; // Already initialized
    
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    this.quotaLimit = parseInt(process.env.YOUTUBE_SEARCH_QUOTA || '10000');
    
    console.log('YouTube Service initializing with API key:', this.apiKey ? 'Present' : 'Missing');
    console.log('Environment variables:', {
      YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY ? 'Present' : 'Missing',
      YOUTUBE_SEARCH_QUOTA: process.env.YOUTUBE_SEARCH_QUOTA,
      YOUTUBE_MAX_RESULTS: process.env.YOUTUBE_MAX_RESULTS,
      YOUTUBE_MIN_DURATION: process.env.YOUTUBE_MIN_DURATION
    });
    
    if (!this.apiKey) {
      console.warn('YouTube API key not found. YouTube search will be disabled.');
      return;
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    });
  }

  private checkQuota(cost: number): boolean {
    if (this.quotaUsed + cost > this.quotaLimit) {
      throw new Error('YouTube API quota exceeded');
    }
    return true;
  }

  private addQuotaUsage(cost: number): void {
    this.quotaUsed += cost;
  }

  async searchVideos(raga: string, artist: string, filters: SearchFilters = {}): Promise<{tracks: any[], quotaUsed: number, quotaStatus: any}> {
    try {
      // Initialize the service if not already done
      this.initialize();
      
      if (!this.apiKey) {
        throw new Error('YouTube API key not configured');
      }

      const {
        minDuration = 1200, // 20 minutes default (more results)
        maxResults = 100 // Increased from 50 to 100
      } = filters;

      // Track quota before search
      const quotaBefore = this.quotaUsed;

      // Get spelling variations for the raga
      const ragaVariations = this.getRagaSpellingVariations(raga);
      console.log(`Searching for raga variations: ${ragaVariations.join(', ')}`);

      // Perform multiple searches with different strategies
      const allResults = await this.performMultiStrategySearch(raga, ragaVariations, artist, minDuration, maxResults);

      // Remove duplicates and prioritize by artist match
      const uniqueResults = this.deduplicateAndPrioritize(allResults, artist);

      // Cache the results
      await this.cacheTracks(raga, artist || 'any', uniqueResults);

      // Calculate quota used in this search
      const quotaUsed = this.quotaUsed - quotaBefore;

      return {
        tracks: uniqueResults.slice(0, 10), // Return top 10 results
        quotaUsed,
        quotaStatus: this.getQuotaStatus()
      };
    } catch (error: any) {
      console.error('YouTube search error:', error);
      if (error.message.includes('quota')) {
        throw new Error('YouTube API quota exceeded. Please try again later.');
      }
      return {
        tracks: [],
        quotaUsed: 0,
        quotaStatus: this.getQuotaStatus()
      };
    }
  }

  private getRagaSpellingVariations(raga: string): string[] {
    const variations = [raga.toLowerCase()];
    const ragaLower = raga.toLowerCase();
    
    // Common spelling variations for Indian classical ragas
    const spellingMap: { [key: string]: string[] } = {
      'bageshri': ['bageshree', 'bageshree', 'bageshri', 'bageshree'],
      'yaman': ['yaman', 'yaman kalyan', 'yaman kalyan'],
      'bhimpalasi': ['bhimpalasi', 'bhimpalasi', 'bhimpalasi'],
      'kafi': ['kafi', 'kafi', 'kafi'],
      'khamaj': ['khamaj', 'khamaj', 'khamaj'],
      'bhairavi': ['bhairavi', 'bhairavi', 'bhairavi'],
      'kalyani': ['kalyani', 'kalyani', 'kalyani'],
      'todi': ['todi', 'todi', 'todi'],
      'malkauns': ['malkauns', 'malkauns', 'malkauns'],
      'darbari': ['darbari', 'darbari', 'darbari']
    };
    
    // Add variations if found in map
    if (spellingMap[ragaLower]) {
      variations.push(...spellingMap[ragaLower]);
    }
    
    // Add common variations for any raga
    if (ragaLower.endsWith('i')) {
      variations.push(ragaLower.replace(/i$/, 'ee'));
    }
    if (ragaLower.endsWith('ee')) {
      variations.push(ragaLower.replace(/ee$/, 'i'));
    }
    
    // Remove duplicates and return
    return [...new Set(variations)];
  }

  private async performMultiStrategySearch(raga: string, ragaVariations: string[], artist: string, minDuration: number, maxResults: number): Promise<any[]> {
    const allResults: any[] = [];
    
    // Strategy 1: Search with each raga variation + artist
    if (artist && artist.trim()) {
      for (const variation of ragaVariations.slice(0, 3)) { // Limit to 3 variations to save quota
        const query = `${variation} raga indian classical music ${artist}`;
        console.log(`Strategy 1 - Searching: "${query}"`);
        const results = await this.performFocusedSearch(query, raga, artist, minDuration, 20);
        allResults.push(...results);
      }
    }
    
    // Strategy 2: Search with each raga variation without artist
    for (const variation of ragaVariations.slice(0, 2)) { // Limit to 2 variations
      const query = `${variation} raga indian classical music`;
      console.log(`Strategy 2 - Searching: "${query}"`);
      const results = await this.performFocusedSearch(query, raga, artist, minDuration, 30);
      allResults.push(...results);
    }
    
    // Strategy 3: Broader search with just raga name
    const broadQuery = `${raga} indian classical music`;
    console.log(`Strategy 3 - Broad search: "${broadQuery}"`);
    const broadResults = await this.performFocusedSearch(broadQuery, raga, artist, minDuration, 25);
    allResults.push(...broadResults);
    
    return allResults;
  }

  private deduplicateAndPrioritize(results: any[], preferredArtist?: string): any[] {
    // Remove duplicates based on video URL
    const uniqueResults = results.filter((video, index, self) => 
      index === self.findIndex(v => v.url === video.url)
    );
    
    // Sort by artist match priority, then by likes
    return uniqueResults.sort((a, b) => {
      const aHasArtist = preferredArtist && a.artist.toLowerCase().includes(preferredArtist.toLowerCase());
      const bHasArtist = preferredArtist && b.artist.toLowerCase().includes(preferredArtist.toLowerCase());
      
      // If one has the preferred artist and the other doesn't, prioritize the one with artist
      if (aHasArtist && !bHasArtist) return -1;
      if (!aHasArtist && bHasArtist) return 1;
      
      // If both have or both don't have the artist, sort by likes
      return b.likes - a.likes;
    });
  }

  private async performFocusedSearch(query: string, raga: string, artist: string, minDuration: number, maxResults: number): Promise<any[]> {
    // Check quota (search costs 100 units)
    this.checkQuota(100);
    this.addQuotaUsage(100);

    const response = await this.youtube.search.list({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: Math.min(maxResults, 50), // YouTube API limit
      order: 'relevance',
      videoDuration: 'long',
      videoDefinition: 'high',
      relevanceLanguage: 'en',
      regionCode: 'IN' // India for better classical music results
    });

    const videos = response.data.items || [];

    if (videos.length === 0) {
      return [];
    }

    // Get video IDs for detailed information
    const videoIds = videos.map((video: any) => video.id.videoId).join(',');

    // Check quota (videos.list costs 1 unit per video)
    this.checkQuota(videos.length);
    this.addQuotaUsage(videos.length);

    const detailsResponse = await this.youtube.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: videoIds
    });

    const videoDetails = detailsResponse.data.items || [];
    
    // Process and filter results with strict raga matching
    const processedVideos = videoDetails
      .map((video: any) => {
        const durationSeconds = this.parseDuration(video.contentDetails.duration);
        
        return {
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt,
          duration: this.formatDuration(durationSeconds),
          viewCount: video.statistics.viewCount || '0',
          likeCount: video.statistics.likeCount || '0',
          commentCount: video.statistics.commentCount || '0',
          url: `https://www.youtube.com/watch?v=${video.id}`,
          durationSeconds,
          likes: parseInt(video.statistics.likeCount || '0'),
          raga: raga, // Always use the searched raga
          artist: this.extractArtistFromTitle(video.snippet.title, video.snippet.channelTitle, artist)
        };
      })
      .filter((video: any) => video.durationSeconds >= minDuration)
      .filter((video: any) => this.isSpecificRagaVideo(video.title, video.description, raga))
      .sort((a: any, b: any) => b.likes - a.likes); // Sort by likes descending

    return processedVideos;
  }

  private isSpecificRagaVideo(title: string, description: string, raga: string): boolean {
    const text = `${title} ${description}`.toLowerCase();
    const ragaLower = raga.toLowerCase();
    
    // Get raga variations for more flexible matching
    const ragaVariations = this.getRagaSpellingVariations(raga);

    // Must contain one of the raga variations
    const hasSpecificRaga = ragaVariations.some(variation => 
      text.includes(variation) || 
      text.includes(variation + ' raga') ||
      text.includes('raga ' + variation)
    );

    // Check for classical music keywords
    const classicalKeywords = [
      'classical', 'raga', 'indian', 'hindustani', 'carnatic',
      'sitar', 'tabla', 'santoor', 'bansuri', 'violin', 'sarangi',
      'alap', 'gat', 'drut', 'vilambit', 'jhala', 'tala'
    ];

    const hasClassicalKeywords = classicalKeywords.some(keyword =>
      text.includes(keyword)
    );

    // Exclude non-classical content
    const excludeKeywords = [
      'bollywood', 'film', 'movie', 'pop', 'rock', 'jazz',
      'western', 'fusion', 'remix', 'cover', 'karaoke'
    ];

    const hasExcludeKeywords = excludeKeywords.some(keyword =>
      text.includes(keyword)
    );

    return hasSpecificRaga && hasClassicalKeywords && !hasExcludeKeywords;
  }

  private extractArtistFromTitle(title: string, channelTitle: string, preferredArtist?: string): string {
    // If we have a preferred artist and it appears in the title, use it
    if (preferredArtist && title.toLowerCase().includes(preferredArtist.toLowerCase())) {
      return preferredArtist;
    }

    // Try to extract artist names from common patterns
    const commonArtists = [
      'Ravi Shankar', 'Zakir Hussain', 'Ali Akbar Khan', 'Hariprasad Chaurasia',
      'Bhimsen Joshi', 'Kumar Gandharva', 'Mallikarjun Mansur', 'Gangubai Hangal',
      'Pandit Jasraj', 'Ustad Amjad Ali Khan', 'Ustad Vilayat Khan', 'Ustad Bismillah Khan',
      'Pandit Shivkumar Sharma', 'Pandit Ram Narayan', 'Pandit Nikhil Banerjee',
      'Ustad Rashid Khan', 'Pandit Ajoy Chakrabarty', 'Pandit Rajan Sajan Mishra'
    ];

    for (const artist of commonArtists) {
      if (title.toLowerCase().includes(artist.toLowerCase())) {
        return artist;
      }
    }

    // If no specific artist found, use channel title or "Various Artists"
    return channelTitle || 'Various Artists';
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  public isClassicalMusicVideo(title: string, description: string, raga: string, artist?: string): boolean {
    const text = `${title} ${description}`.toLowerCase();
    const ragaLower = raga.toLowerCase();
    
    // Check for raga name in title or description
    const hasRaga = text.includes(ragaLower) || 
                   text.includes('raga') || 
                   text.includes('classical');
    
    // Check for artist name if provided
    const hasArtist = !artist || text.includes(artist.toLowerCase());
    
    // Check for classical music keywords
    const classicalKeywords = [
      'classical', 'raga', 'indian', 'hindustani', 'carnatic',
      'sitar', 'tabla', 'santoor', 'bansuri', 'violin', 'sarangi',
      'alap', 'gat', 'drut', 'vilambit', 'jhala', 'tala'
    ];
    
    const hasClassicalKeywords = classicalKeywords.some(keyword => 
      text.includes(keyword)
    );
    
    // Exclude non-classical content
    const excludeKeywords = [
      'bollywood', 'film', 'movie', 'pop', 'rock', 'jazz',
      'western', 'fusion', 'remix', 'cover', 'karaoke'
    ];
    
    const hasExcludeKeywords = excludeKeywords.some(keyword => 
      text.includes(keyword)
    );
    
    return hasRaga && hasArtist && hasClassicalKeywords && !hasExcludeKeywords;
  }

  getQuotaStatus(): { used: number; limit: number; remaining: number } {
    return {
      used: this.quotaUsed,
      limit: this.quotaLimit,
      remaining: this.quotaLimit - this.quotaUsed
    };
  }

  resetQuota(): void {
    this.quotaUsed = 0;
  }

  private async cacheTracks(raga: string, artist: string, videos: any[]): Promise<void> {
    try {
      const searchKey = `${raga.toLowerCase()}_${artist.toLowerCase()}`;

      for (const video of videos) {
        // Create unique search key for each video to avoid duplicates
        const uniqueSearchKey = `${searchKey}_${video.id}`;
        
        // Check if track already exists
        const existingTrack = await Track.findOne({ url: video.url });
        if (existingTrack) {
          continue; // Skip if already cached
        }

        const track = new Track({
          raga: video.raga || raga,
          artist: video.artist || artist,
          title: video.title,
          url: video.url,
          duration: video.duration,
          durationSeconds: video.durationSeconds,
          likes: video.likes,
          thumbnail: video.thumbnail,
          searchKey: uniqueSearchKey,
          isCurated: false
        });

        await track.save();
      }
    } catch (error) {
      console.error('Error caching tracks:', error);
    }
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  async getCuratedTracks(): Promise<any[]> {
    try {
      const tracks = await Track.find({ isCurated: true })
        .sort({ likes: -1 })
        .limit(10);

      return tracks.map(track => ({
        id: track._id,
        title: track.title,
        url: track.url,
        duration: track.duration,
        thumbnail: track.thumbnail,
        likes: track.likes,
        raga: track.raga,
        artist: track.artist,
        ratings: track.ratings
      }));
    } catch (error) {
      console.error('Error fetching curated tracks:', error);
      return [];
    }
  }
}

export default new YouTubeService();
