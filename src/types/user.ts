export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: "STUDENT" | "INSTRUCTOR" | "SUPERADMIN";
  avatar: string | null;
  twoStep: string;
  emailVerified: boolean;
  isBanned: boolean;
  createdAt: string;
}
