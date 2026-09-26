export interface JwtPayload {
  userId: string;
  email: string;
}

export interface DecodedToken extends JwtPayload {
  iat: number;
  exp: number;
}
