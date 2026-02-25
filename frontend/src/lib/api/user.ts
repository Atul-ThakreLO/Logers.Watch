import apiClient from "./client";
import { User } from "./auth";

export interface UpdateUserData {
  name?: string;
}

export const userService = {
  async getProfile(): Promise<{ user: User }> {
    const response = await apiClient.get<{ user: User }>("/users/me");
    return response.data;
  },

  async getById(id: string): Promise<{ user: User }> {
    const response = await apiClient.get<{ user: User }>(`/users/${id}`);
    return response.data;
  },

  async updateProfile(data: UpdateUserData): Promise<{ user: User }> {
    const response = await apiClient.patch<{ user: User }>("/users/me", data);
    return response.data;
  },

  async deleteAccount(): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>("/users/me");
    return response.data;
  },
};

export default userService;
