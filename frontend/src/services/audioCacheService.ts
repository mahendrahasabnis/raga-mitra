// Audio caching service for better playback performance
class AudioCacheService {
  private cache: Map<string, HTMLAudioElement> = new Map();
  private preloadQueue: string[] = [];
  private isPreloading = false;
  private tracksData: any[] = [];

  // Get cached audio element or create new one
  getAudioElement(trackId: string, audioUrl: string): HTMLAudioElement {
    if (this.cache.has(trackId)) {
      const audio = this.cache.get(trackId)!;
      // Reset audio to beginning
      audio.currentTime = 0;
      return audio;
    }

    // Create new audio element
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    audio.src = audioUrl;
    
    // Cache the audio element
    this.cache.set(trackId, audio);
    
    return audio;
  }

  // Preload audio files in background (now handled by individual AudioPlayer components)
  preloadAudio(tracks: any[]) {
    // Store tracks data for reference
    this.tracksData = tracks;
    console.log('Audio cache service ready for', tracks.length, 'tracks');
  }

  private async processPreloadQueue() {
    if (this.isPreloading || this.preloadQueue.length === 0) return;

    this.isPreloading = true;

    while (this.preloadQueue.length > 0) {
      const trackId = this.preloadQueue.shift()!;
      
      try {
        // Find the track data
        const track = this.findTrackById(trackId);
        if (!track || !track.audioUrl) continue;

        // Create and cache audio element
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.preload = 'metadata';
        audio.src = track.audioUrl;
        
        // Wait for metadata to load
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Preload timeout'));
          }, 10000);

          audio.addEventListener('loadedmetadata', () => {
            clearTimeout(timeout);
            resolve(void 0);
          });

          audio.addEventListener('error', (e) => {
            clearTimeout(timeout);
            reject(e);
          });

          audio.load();
        });

        this.cache.set(trackId, audio);
        console.log(`Preloaded audio for track: ${track.title}`);
        
        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`Failed to preload audio for track ${trackId}:`, error);
      }
    }

    this.isPreloading = false;
  }

  private findTrackById(trackId: string): any {
    return this.tracksData.find(track => track._id === trackId);
  }

  // Clear cache
  clearCache() {
    this.cache.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    this.cache.clear();
    this.preloadQueue = [];
  }

  // Get cache size
  getCacheSize(): number {
    return this.cache.size;
  }

  // Check if track is cached
  isCached(trackId: string): boolean {
    return this.cache.has(trackId);
  }
}

export const audioCacheService = new AudioCacheService();
