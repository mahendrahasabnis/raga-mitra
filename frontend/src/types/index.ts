export interface User {
  id: string;
  phone: string;
  credits: number;
  isAdmin: boolean;
}

export interface Raga {
  _id: string;
  name: string;
  tags: string[];
  idealHours: number[];
  description: string;
  isRecommended: boolean;
}

export interface Artist {
  _id: string;
  name: string;
  knownRagas: string[];
  bio: string;
  imgUrl: string;
  rating: number;
}

export interface Track {
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  likes: number;
  isCurated: boolean;
  raga?: string;
  artist?: string;
  ratings?: TrackRating[];
}

export interface TrackRating {
  userId: string;
  rating: number;
  createdAt: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export type { AuthResponse };

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}
