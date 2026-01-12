// Healthcare app User interface (credits removed as not relevant)
export interface User {
  id: string;
  phone: string;
  isAdmin: boolean;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}
