export interface User {
    id?: number;
    username: string;
    email: string;
    password: string;
    confirmed?: boolean;
    blocked?: boolean;
    role?: string;
  }
  